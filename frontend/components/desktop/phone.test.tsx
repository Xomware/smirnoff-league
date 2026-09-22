import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Taskbar } from "@/components/xp/Taskbar";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { stubSleeper } from "@/lib/test/league-mock";
import { Desktop } from "./Desktop";

// A 390px iPhone: only the phone query matches.
function phoneWidth() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query === "(max-width: 767.98px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function renderDesktop() {
  return render(
    <DesktopProvider>
      <Desktop />
      <Taskbar />
    </DesktopProvider>,
  );
}

const visibleWindows = () => [...document.querySelectorAll<HTMLElement>("section.xp-desktop-window")].filter((w) => !w.hidden);

beforeEach(() => {
  stubSleeper();
  phoneWidth();
});
afterEach(() => {
  vi.restoreAllMocks();
  // The desktop mirrors its windows into ?open=, which the next render would reopen.
  window.history.replaceState(null, "", "/");
});

describe("phone taskbar", () => {
  it("collapses the tabs into one windows button that lists every window", () => {
    renderDesktop();
    expect(screen.queryByRole("list", { name: "Open windows" })).toBeNull();

    const button = screen.getByRole("button", { name: "4 windows" });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByRole("list", { name: "Open windows" });
    const titles = within(list).getAllByRole("button").map((b) => b.textContent);
    expect(titles.sort()).toEqual([
      "League News",
      "League Standings",
      "Now Playing - Draft Recap",
      "Smirnoff Fantasy Football League",
    ]);
    expect(within(list).getByRole("button", { name: "Smirnoff Fantasy Football League" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(list).getByRole("button", { name: "League Standings" }));

    expect(screen.queryByRole("list", { name: "Open windows" })).toBeNull();
    expect(visibleWindows().map((w) => w.getAttribute("aria-label"))).toEqual(["League Standings"]);
  });

  it("closes the list on Escape and returns focus to its button", () => {
    renderDesktop();
    const button = screen.getByRole("button", { name: "4 windows" });
    fireEvent.click(button);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("list", { name: "Open windows" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

describe("at 390px", () => {
  it("opens Scores, expands a matchup, drills to a team and goes Back, one window on screen throughout", async () => {
    renderDesktop();

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Start menu" })).getByRole("button", { name: "Scores" }));
    const scores = visibleWindows()[0];
    expect(visibleWindows()).toHaveLength(1);
    expect(scores.getAttribute("aria-label")).toBe("Scores");
    expect(scores.dataset.maximized).toBe("true");
    expect(screen.getByRole("button", { name: "5 windows" })).toBeTruthy();

    fireEvent.change(await within(scores).findByRole("combobox"), { target: { value: "1" } });
    const toggle = within(await within(scores).findByRole("region", { name: "Matchup 1" })).getByRole("button", {
      expanded: false,
    });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const drill = within(scores).getAllByRole("button").find((b) => b.classList.contains("xp-drill") && /Team \d+/.test(b.textContent ?? ""))!;
    const team = drill.textContent!.match(/Team \d+/)![0];

    fireEvent.click(drill);

    expect(visibleWindows()).toEqual([scores]);
    expect(scores.getAttribute("aria-label")).toBe(`Team Profile - ${team}`);
    expect(await within(scores).findByRole("table", { name: "Weekly results" })).toBeTruthy();

    fireEvent.click(within(scores).getByRole("button", { name: "Back" }));

    expect(visibleWindows()).toEqual([scores]);
    expect(scores.getAttribute("aria-label")).toBe("Scores");
    expect(within(scores).getByRole("button", { name: "Forward" })).toHaveProperty("disabled", false);
  });
});
