import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFilters, type FilterField, type FilterValues } from "@/lib/filters/filters";
import { FilterBar } from "./FilterBar";

const FIELDS: FilterField[] = [
  { key: "week", label: "Week", options: [{ value: "all", label: "All" }, { value: "1", label: "W1 (3)" }, { value: "2", label: "W2 (1)" }] },
  { key: "ice", label: "Ice type", options: [{ value: "all", label: "All" }, { value: "zero", label: "Zero" }, { value: "late", label: "Late" }] },
  { key: "sort", label: "Sort", options: [{ value: "newest", label: "Newest" }, { value: "fastest", label: "Fastest time" }] },
];

function Harness({ initial = {} }: { initial?: FilterValues }) {
  const [values, setValues] = useState({ ...defaultFilters(FIELDS), ...initial });
  const n = values.week === "all" ? 4 : values.week === "1" ? 3 : 1;
  return <FilterBar fields={FIELDS} values={values} count={`${n} videos`} onChange={setValues} />;
}

const phone = (on: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: on && query === "(max-width: 639.98px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );

const chips = () => within(screen.getByRole("group", { name: "Active filters" })).getAllByRole("button").map((b) => b.textContent);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FilterBar, wide", () => {
  it("shows a select per field in a Filters group box and the live result count", () => {
    phone(false);
    render(<Harness />);
    const bar = screen.getByRole("group", { name: "Filters" });
    expect(bar.classList.contains("xp-group")).toBe(true);
    expect(within(bar).getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toBe("4 videos");
    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Week"), { target: { value: "1" } });
    expect(screen.getByRole("status").textContent).toBe("3 videos");
    expect(chips()).toEqual(["Week: W1 (3)", "Clear all"]);
  });

  it("removes one filter from its chip and all of them with Clear all", () => {
    phone(false);
    render(<Harness initial={{ week: "2", ice: "late", sort: "fastest" }} />);
    expect(chips()).toEqual(["Week: W2 (1)", "Ice type: Late", "Sort: Fastest time", "Clear all"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Ice type: Late" }));
    expect(chips()).toEqual(["Week: W2 (1)", "Sort: Fastest time", "Clear all"]);
    expect((screen.getByLabelText("Ice type") as HTMLSelectElement).value).toBe("all");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
    expect((screen.getByLabelText("Week") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByLabelText("Sort") as HTMLSelectElement).value).toBe("newest");
  });
});

describe("FilterBar, phone", () => {
  const opener = () => screen.getByRole("button", { name: /^Filters/ });
  const sheet = () => screen.getByRole("dialog", { name: "Filters" });

  it("collapses to one Filters button with an active count, and chips under it", () => {
    phone(true);
    render(<Harness initial={{ week: "1", sort: "fastest" }} />);
    expect([...document.querySelectorAll("select")].filter((s) => !s.closest("[inert]"))).toHaveLength(0);
    expect(opener().textContent).toMatch(/Filters\s*2/);
    expect(opener().getAttribute("aria-expanded")).toBe("false");
    expect(chips()).toEqual(["Week: W1 (3)", "Sort: Fastest time", "Clear all"]);
    expect(screen.getByRole("status").textContent).toBe("3 videos");
  });

  it("opens a modal bottom sheet, applies the picked filters and returns focus to the button", () => {
    phone(true);
    render(<Harness />);
    expect(opener().textContent).toBe("Filters");
    fireEvent.click(opener());
    expect(sheet().getAttribute("aria-modal")).toBe("true");
    expect(sheet().closest("[data-side]")?.getAttribute("data-side")).toBe("bottom");
    expect(sheet().closest("[inert]")).toBeNull();
    expect(sheet().contains(document.activeElement)).toBe(true);

    fireEvent.change(within(sheet()).getByLabelText("Week"), { target: { value: "2" } });
    fireEvent.change(within(sheet()).getByLabelText("Ice type"), { target: { value: "zero" } });
    expect(screen.getByRole("status").textContent).toBe("4 videos");
    fireEvent.click(within(sheet()).getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("dialog", { hidden: true, name: "Filters" }).closest("[inert]")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("1 videos");
    expect(chips()).toEqual(["Week: W2 (1)", "Ice type: Zero", "Clear all"]);
    expect(document.activeElement).toBe(opener());
  });

  it("resets the sheet to the defaults without applying until Apply, and Escape discards", () => {
    phone(true);
    render(<Harness initial={{ week: "1", ice: "late" }} />);
    fireEvent.click(opener());
    expect((within(sheet()).getByLabelText("Week") as HTMLSelectElement).value).toBe("1");
    fireEvent.click(within(sheet()).getByRole("button", { name: "Reset" }));
    expect((within(sheet()).getByLabelText("Week") as HTMLSelectElement).value).toBe("all");
    expect((within(sheet()).getByLabelText("Ice type") as HTMLSelectElement).value).toBe("all");
    expect(chips()).toEqual(["Week: W1 (3)", "Ice type: Late", "Clear all"]);

    fireEvent.keyDown(sheet(), { key: "Escape" });
    expect(chips()).toEqual(["Week: W1 (3)", "Ice type: Late", "Clear all"]);

    fireEvent.click(opener());
    fireEvent.click(within(sheet()).getByRole("button", { name: "Reset" }));
    fireEvent.click(within(sheet()).getByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("group", { name: "Active filters" })).toBeNull();
    expect(opener().textContent).toBe("Filters");
  });

  it("traps Tab inside the sheet", () => {
    phone(true);
    render(<Harness />);
    fireEvent.click(opener());
    const focusable = [...sheet().querySelectorAll<HTMLElement>("button, select")];
    const [first, last] = [focusable[0], focusable.at(-1)!];
    expect(last.textContent).toBe("Apply");

    act(() => last.focus());
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
