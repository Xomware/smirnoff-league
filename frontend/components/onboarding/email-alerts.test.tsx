import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  updateMe: vi.fn(),
}));

import { ApiError, updateMe, type EmailPrefs, type Profile } from "@/lib/api/users";
import { EmailAlerts } from "./email-alerts";
import { stubSleeper } from "./league-stub";
import { OnboardingWizard } from "./onboarding-wizard";

const ALL_ON = { iced: true, due48h: true, due6h: true, lateAdded: true, edition: true, videoOfMine: true };
const OFF: EmailPrefs = { optIn: false, types: ALL_ON };
const LABELS = [
  "When I get iced",
  "48 hours before an ice is due",
  "6 hours before",
  "When a late ice is added",
  "When the commish posts a new edition",
  "When someone posts a video of my chug",
];

const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const optIn = () => box("Email me alerts at player@example.com");

beforeEach(() => {
  vi.mocked(updateMe).mockReset();
  vi.mocked(updateMe).mockImplementation(async () => ({}) as Profile);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EmailAlerts", () => {
  it("shows the address and the six toggles, locked until opted in", () => {
    render(<EmailAlerts address="player@example.com" initial={OFF} />);
    expect(optIn().checked).toBe(false);
    for (const label of LABELS) {
      expect(box(label).checked).toBe(true);
      expect(box(label).disabled).toBe(true);
    }
  });

  it("saves opting in, then one type off, as the whole email object", async () => {
    render(<EmailAlerts address="player@example.com" initial={OFF} />);

    fireEvent.click(optIn());
    await waitFor(() => expect(box("6 hours before").disabled).toBe(false));
    expect(updateMe).toHaveBeenLastCalledWith({ email: { optIn: true, types: ALL_ON } });

    fireEvent.click(box("6 hours before"));
    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(2));
    expect(updateMe).toHaveBeenLastCalledWith({ email: { optIn: true, types: { ...ALL_ON, due6h: false } } });
    expect(box("6 hours before").checked).toBe(false);
  });

  it("puts the toggle back and says so when the save fails", async () => {
    vi.mocked(updateMe).mockRejectedValue(new ApiError(500, "Internal error"));
    render(<EmailAlerts address="player@example.com" initial={{ optIn: true, types: ALL_ON }} />);

    fireEvent.click(box("When I get iced"));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Could not save your email alerts (Internal error). Try again.",
    );
    expect(box("When I get iced").checked).toBe(true);
  });
});

describe("My Profile", () => {
  const PROFILE: Profile = {
    name: "Player One",
    username: "player.one",
    rosterId: 6,
    email: OFF,
    createdAt: "2026-09-22T12:00:00+00:00",
    updatedAt: "2026-09-22T12:00:00+00:00",
  };

  beforeEach(() => stubSleeper());

  it("adds an Email alerts step after the team", async () => {
    render(<OnboardingWizard initial={PROFILE} address="player@example.com" onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findAllByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: "Email alerts" })).toBeTruthy();
    expect(optIn().checked).toBe(false);
  });

  it("leaves Email alerts out of first-time setup", async () => {
    render(<OnboardingWizard address="player@example.com" onDone={vi.fn()} />);
    expect(screen.queryByText("Email alerts")).toBeNull();
  });
});
