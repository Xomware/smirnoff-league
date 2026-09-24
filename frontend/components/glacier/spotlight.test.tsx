import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DrillContext, type DrillTarget } from "@/components/views/drill-link";
import { type Fact, Spotlight } from "./Spotlight";

const FACTS: Fact[] = [
  { id: "a", label: "Most ices, season", value: "Team 13", sub: "4 ices", to: { kind: "ice-standings" } },
  { id: "b", label: "Standings leader", value: "Team 1", sub: "2-0", to: { kind: "standings" } },
  { id: "c", label: "Fastest chug", value: "Speedy", sub: "6.4s", to: { kind: "chug-rankings" } },
];

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

function renderSpot(open = vi.fn<(to: DrillTarget) => void>()) {
  render(
    <DrillContext value={open}>
      <Spotlight id="spot" label="Quick hitters" facts={FACTS} />
    </DrillContext>,
  );
  return open;
}

const card = () => within(screen.getByRole("region", { name: "Quick hitters" }));
const shown = () => card().getByRole("group").getAttribute("aria-label");
const tick = () => act(() => vi.advanceTimersByTime(5000));

beforeEach(() => {
  reducedMotion(false);
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Spotlight", () => {
  it("rotates to the next fact every 5 seconds and wraps around", () => {
    renderSpot();
    expect(shown()).toBe("Most ices, season, 1 of 3");

    tick();
    expect(shown()).toBe("Standings leader, 2 of 3");
    tick();
    tick();
    expect(shown()).toBe("Most ices, season, 1 of 3");
  });

  it("pauses while hovered or focused and resumes after", () => {
    renderSpot();
    const region = screen.getByRole("region", { name: "Quick hitters" });

    fireEvent.pointerEnter(region);
    tick();
    expect(shown()).toBe("Most ices, season, 1 of 3");
    fireEvent.pointerLeave(region);
    tick();
    expect(shown()).toBe("Standings leader, 2 of 3");

    const next = card().getByRole("button", { name: "Next fact" });
    act(() => next.focus());
    tick();
    tick();
    expect(shown()).toBe("Standings leader, 2 of 3");
    act(() => next.blur());
    tick();
    expect(shown()).toBe("Fastest chug, 3 of 3");
  });

  it("steps with prev, next and the dots", () => {
    renderSpot();
    fireEvent.click(card().getByRole("button", { name: "Previous fact" }));
    expect(shown()).toBe("Fastest chug, 3 of 3");
    fireEvent.click(card().getByRole("button", { name: "Next fact" }));
    expect(shown()).toBe("Most ices, season, 1 of 3");
    fireEvent.click(card().getByRole("button", { name: "Show Standings leader" }));
    expect(shown()).toBe("Standings leader, 2 of 3");
    expect(card().getByRole("button", { name: "Show Standings leader" }).getAttribute("aria-current")).toBe("true");
  });

  it("opens the page behind the fact on show", () => {
    const open = renderSpot();
    tick();
    fireEvent.click(card().getByRole("button", { name: "View more: Standings leader" }));
    expect(open).toHaveBeenCalledWith({ kind: "standings" });
  });

  it("lists every fact without rotating under reduced motion", () => {
    reducedMotion(true);
    const open = renderSpot();

    const items = within(card().getByRole("list", { name: "Quick hitters" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Team 13"),
      expect.stringContaining("Team 1"),
      expect.stringContaining("Speedy"),
    ]);
    expect(card().queryByRole("button", { name: "Next fact" })).toBeNull();
    tick();
    expect(card().getAllByRole("listitem")).toHaveLength(3);

    for (const f of FACTS) fireEvent.click(card().getByRole("button", { name: `View more: ${f.label}` }));
    expect(open.mock.calls.map(([to]) => to)).toEqual(FACTS.map((f) => f.to));
  });
});
