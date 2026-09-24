import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));
vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));

import { GlacierShell } from "@/components/glacier/GlacierShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import { AlertsProvider } from "@/lib/alerts/alerts";
import { getLedger } from "@/lib/api/ledger";
import { getMe } from "@/lib/api/users";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { espnEvent, jsonResponse } from "@/lib/test/espn-mock";
import { SCENARIO_LEDGER } from "@/lib/test/ledger-mock";
import { golden, stubSleeper } from "@/lib/test/league-mock";

const SHELLS = {
  "XP phone": () => <MobileShell theme="xp" />,
  "Glacier phone": () => <MobileShell theme="glacier" />,
  "Glacier desktop": () => <GlacierShell />,
} satisfies Record<string, () => ReactNode>;
type Shell = keyof typeof SHELLS;
const PHONES = ["XP phone", "Glacier phone"] as const;

// Every stylesheet a page can pick up, so a scroll box set anywhere shows.
function withAllCss() {
  const dirs = ["mobile", "glacier", "views", "windows", "videos", "ticker", "home", "palette"].map((d) => join(__dirname, "..", d));
  const files = [join(__dirname, "../../app/globals.css"), ...dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".css")).map((f) => join(d, f)))];
  const style = document.createElement("style");
  style.textContent = files.map((f) => readFileSync(f, "utf8")).join("\n");
  document.head.append(style);
}

function open(shell: Shell, search = "") {
  window.history.replaceState(null, "", `/${search}`);
  render(
    <ProfileProvider>
      <AlertsProvider>
        <NotificationsProvider>{SHELLS[shell]()}</NotificationsProvider>
      </AlertsProvider>
    </ProfileProvider>,
  );
}

let y = 0;
function scrollPage(to: number) {
  y = to;
  window.dispatchEvent(new Event("scroll"));
}

const page = () => document.querySelector<HTMLElement>(".m-screen:not([hidden])")!;
const drawer = () => screen.getByRole("dialog", { name: "Menu", hidden: true });
const burger = () => within(screen.getByRole("banner")).getByRole("button", { name: "Menu" });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  stubSleeper();
  const sleeper = vi.mocked(fetch).getMockImplementation()!;
  // Week 3 has no lineups in the stub; W2's give Ice Watch teams to list.
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("espn.com")) return jsonResponse({ events: [] });
    if (url.endsWith("/matchups/3")) return jsonResponse(golden.weeks[1].matchups);
    return sleeper(input, init);
  });
  vi.mocked(getLedger).mockResolvedValue(SCENARIO_LEDGER);
  vi.mocked(getMe).mockResolvedValue({
    sub: "s",
    email: "e",
    isAdmin: false,
    profile: { name: "Thirteen", username: "t", rosterId: 13, createdAt: "", updatedAt: "" },
  });
  y = 0;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
  vi.spyOn(window, "scrollTo").mockImplementation(((_: number, to: number) => {
    y = to;
  }) as typeof window.scrollTo);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("style");
  window.history.replaceState(null, "", "/");
});

vi.setConfig({ testTimeout: 20000 });

describe("the phone scrolls the document", () => {
  it.each(PHONES)("%s: no fixed app box, the page flows, the header and ticker stick", (shell) => {
    withAllCss();
    open(shell);

    const app = getComputedStyle(document.querySelector(".m-app")!);
    expect(app.position).not.toBe("fixed");
    expect(app.height).not.toBe("100dvh");
    expect(getComputedStyle(page()).position).not.toBe("absolute");
    expect(getComputedStyle(page()).overflow).not.toMatch(/auto|scroll/);

    const top = screen.getByRole("banner").parentElement!;
    expect(getComputedStyle(top).position).toBe("sticky");
    expect(getComputedStyle(top).top).toBe("0px");
    expect(top.querySelector(".tk")).not.toBeNull();
  });

  it("locks the page while the drawer is open and leaves it where it was", async () => {
    open("Glacier phone");
    act(() => scrollPage(300));

    fireEvent.click(burger());
    await waitFor(() => expect(document.documentElement.style.overflow).toBe("hidden"));

    fireEvent.click(within(drawer()).getByRole("button", { name: "Close menu" }));
    await waitFor(() => expect(document.documentElement.style.overflow).toBe(""));
    expect(window.scrollY).toBe(300);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("starts a new page at the top, and Back returns to where the last one was left", async () => {
    open("XP phone");
    act(() => scrollPage(400));

    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: /notifications/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toBeTruthy());
    expect(window.scrollY).toBe(0);

    act(() => scrollPage(120));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Back" })).toBeNull());
    expect(window.scrollY).toBe(400);
  });
});

// A box that scrolls inside the page is a second scroll. Dialogs, drawers and
// sheets are overlays, so they may scroll on their own.
function innerScrollers(root: Element) {
  return [...root.querySelectorAll<HTMLElement>("*")]
    .filter((el) => !el.closest('[role="dialog"], [role="alertdialog"]'))
    .filter((el) => {
      const s = getComputedStyle(el);
      return (
        /auto|scroll/.test(s.overflowY) ||
        /auto|scroll/.test(s.overflow.split(" ").at(-1) ?? "") ||
        /\boverflow(-y)?-(auto|scroll)\b/.test(el.getAttribute("class") ?? "")
      );
    })
    .map((el) => el.getAttribute("class") || el.tagName);
}

const PAGES: [string, string, () => Promise<unknown>][] = [
  ["Ice Watch", "?open=watch", () => screen.findAllByRole("region", { name: /ice watch$/ })],
  ["the Ledger", "?open=ices", () => screen.findByText(/^Week 2 · /)],
  ["Stats", "?open=stats", () => screen.findByRole("tablist", { name: "Ice Stats sections" })],
  ["News", "?open=news", () => screen.findByRole("heading", { name: "The Smirnoff Times" })],
];

describe("no scroll box inside a page", () => {
  it.each(
    (["XP phone", "Glacier phone", "Glacier desktop"] as const).flatMap((shell) => PAGES.map(([name, search, ready]) => [shell, name, search, ready] as const)),
  )("%s, %s", async (shell, _, search, ready) => {
    withAllCss();
    open(shell, search);
    await ready();

    const root = document.querySelector(shell === "Glacier desktop" ? ".glacier-page" : ".m-screen:not([hidden])")!;
    expect(innerScrollers(root)).toEqual([]);
  });
});

// An absolutely positioned box, like a Tailwind sr-only label, is clipped by
// its containing block, not by the nearest scroller. When the containing block
// sits outside a sideways strip, the box lands off to the right and widens the
// page (#235). Tailwind's utilities aren't in the CSS read here, so sr-only
// counts as absolute by class.
function escapesStrip(root: Element) {
  const positioned = (el: Element) => getComputedStyle(el).position !== "static";
  const strips = [...root.querySelectorAll<HTMLElement>("*")].filter((el) => getComputedStyle(el).overflowX !== "visible");
  return strips.flatMap((strip) =>
    [...strip.querySelectorAll("*")]
      .filter((el) => el.classList.contains("sr-only") || getComputedStyle(el).position === "absolute")
      .filter((el) => {
        let cb = el.parentElement;
        while (cb && !positioned(cb)) cb = cb.parentElement;
        return !cb || !strip.contains(cb);
      })
      .map((el) => `${strip.getAttribute("aria-label") ?? strip.className}: ${el.textContent}`),
  );
}

describe("nothing escapes a sideways strip", () => {
  // Every game final, so the week's zeros lock and the cards carry ice badges.
  const NFL = "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WSH".split(" ");
  const finals = NFL.filter((_, i) => i % 2 === 0).map((home, i) => espnEvent({ home, away: NFL[i * 2 + 1], status: "STATUS_FINAL", period: 4 }));

  it("XP phone Home", async () => {
    const sleeper = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => (String(input).includes("espn.com") ? jsonResponse({ events: finals }) : sleeper(input, init)));
    withAllCss();
    open("XP phone");
    const strip = await screen.findByRole("list", { name: "This week's matchups" });
    await waitFor(() => expect(strip.querySelector(".sr-only")).not.toBeNull());

    expect(escapesStrip(page())).toEqual([]);
  });
});
