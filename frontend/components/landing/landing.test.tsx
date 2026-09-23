import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubSleeper } from "@/lib/test/league-mock";
import { Landing } from "./landing";

const RULE_TEXT = [
  /scores 0\.0 or less/i,
  /empty slot/i,
  /on bye/i,
  /lowest scoring team of the week/i,
  /next sunday at 1:00 pm/i,
  /another ice for every ice still owed/i,
  /300-piece puzzle/i,
  /head lamp/i,
];

function reduceMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function spyObserver() {
  const observe = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      unobserve() {}
      disconnect() {}
    },
  );
  return observe;
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
});

afterEach(() => {
  reduceMotion(false);
  vi.restoreAllMocks();
});

describe("Landing sign-in", () => {
  it("calls onSignIn from every sign-in button", () => {
    const onSignIn = vi.fn();
    render(<Landing onSignIn={onSignIn} />);

    const buttons = screen.getAllByRole("button", { name: /sign in with google/i });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const b of buttons) fireEvent.click(b);

    expect(onSignIn).toHaveBeenCalledTimes(buttons.length);
  });

  it("disables every sign-in button when there is no handler", () => {
    render(<Landing />);
    for (const b of screen.getAllByRole("button", { name: /sign in with google/i })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe("Landing hero", () => {
  it("leads with the crest, the league name and a sign-in button", () => {
    render(<Landing onSignIn={() => {}} />);
    const hero = screen.getByRole("region", { name: "Welcome" });

    const crest = within(hero).getByRole("img", { name: /smirnoff ice fantasy football league crest/i });
    expect(crest.getAttribute("src")).toContain("crest.png");
    expect(within(hero).getByRole("heading", { level: 1 }).textContent).toMatch(/smirnoff league/i);
    expect(within(hero).getByRole("button", { name: /sign in with google/i })).toBeTruthy();
  });

  it("points a scroll cue at the section right under the hero", () => {
    render(<Landing onSignIn={() => {}} />);
    const cue = screen.getByRole("link", { name: /scroll/i });
    const target = document.getElementById(cue.getAttribute("href")!.slice(1));

    expect(target).not.toBeNull();
    expect(screen.getByRole("region", { name: "Welcome" }).nextElementSibling).toBe(target);
  });

  it("brings the mascot into the rules", () => {
    render(<Landing onSignIn={() => {}} />);
    const mascots = screen.getAllByRole("img", { name: /robot chugging a smirnoff ice/i });
    expect(mascots.length).toBeGreaterThan(0);
    expect(mascots[0].getAttribute("src")).toContain("mascot.png");
  });
});

describe("Landing motion", () => {
  it("renders every rule and the finished demo statically under reduced motion", () => {
    reduceMotion(true);
    const observe = spyObserver();
    const { container } = render(<Landing onSignIn={() => {}} />);

    for (const text of RULE_TEXT) expect(screen.getByText(text)).toBeTruthy();
    expect(container.querySelector("[data-motion='on']")).toBeNull();
    expect(observe).not.toHaveBeenCalled();

    const row = screen.getByTestId("ice-watch-row");
    expect(row.classList).toContain("ice");
    expect(row.textContent).toContain("0.00");
    expect(screen.getByText("x3")).toBeTruthy();
  });

  it("waits for each section to scroll into view when motion is allowed", () => {
    const observe = spyObserver();
    const { container } = render(<Landing onSignIn={() => {}} />);

    expect(container.querySelector("[data-motion='on']")).not.toBeNull();
    expect(observe).toHaveBeenCalled();
  });
});

describe("Landing league status", () => {
  // stubSleeper answers Sleeper and 404s everything else, ESPN included.
  it.each([
    ["Sleeper and ESPN are down", () => {}],
    ["only ESPN is down", stubSleeper],
  ])("hides itself when %s, and sign-in still works", async (_, stub) => {
    stub();
    const onSignIn = vi.fn();
    render(<Landing onSignIn={onSignIn} />);

    expect(screen.getByRole("status", { name: /loading league status/i })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("status", { name: /loading league status/i })).toBeNull());
    expect(screen.queryByRole("region", { name: /league status/i })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /sign in with google/i })[0]);
    expect(onSignIn).toHaveBeenCalledOnce();
  });
});
