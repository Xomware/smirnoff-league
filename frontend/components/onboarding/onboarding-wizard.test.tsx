import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

import { ApiError, updateMe } from "@/lib/api/users";
import { stubSleeper } from "./league-stub";
import { OnboardingWizard } from "./onboarding-wizard";

const heading = (name: string) => screen.getByRole("heading", { name });
const next = () => fireEvent.click(screen.getByRole("button", { name: /next/i }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function toTeamStep() {
  type("Full name", "  Player One  ");
  next();
  type("Username", "player.one");
  next();
  expect(heading("Pick your team")).toBeTruthy();
  return screen.findAllByRole("radio");
}

beforeEach(() => {
  vi.mocked(updateMe).mockReset();
  stubSleeper();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OnboardingWizard", () => {
  it("blocks Next until the name is valid", () => {
    render(<OnboardingWizard onDone={vi.fn()} />);

    next();
    expect(heading("Your name")).toBeTruthy();
    expect(screen.getByText("Enter your name.")).toBeTruthy();

    type("Full name", "   ");
    next();
    expect(heading("Your name")).toBeTruthy();

    type("Full name", "Player One");
    expect(screen.queryByText("Enter your name.")).toBeNull();
    next();
    expect(heading("Pick a username")).toBeTruthy();
  });

  it("shows username validation errors inline", () => {
    render(<OnboardingWizard onDone={vi.fn()} />);
    type("Full name", "Player One");
    next();

    const input = screen.getByLabelText("Username");
    type("Username", "p");
    fireEvent.blur(input);
    expect(screen.getByText("Use 2 to 20 characters.")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");

    type("Username", "player one!");
    expect(screen.getByText("Use only letters, numbers, _ . and -.")).toBeTruthy();
    next();
    expect(heading("Pick a username")).toBeTruthy();

    type("Username", "player.one");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    next();
    expect(heading("Pick your team")).toBeTruthy();
  });

  it("offers all 14 rosters with no taken state, so a claimed one can still be picked", async () => {
    render(<OnboardingWizard onDone={vi.fn()} />);
    const radios = await toTeamStep();

    expect(radios).toHaveLength(14);
    expect(radios.every((r) => !(r as HTMLInputElement).disabled)).toBe(true);
    expect(screen.queryByText(/taken|claimed/i)).toBeNull();

    const team6 = screen.getByRole("radio", { name: /Team 6\b/ }) as HTMLInputElement;
    fireEvent.click(team6);
    expect(team6.checked).toBe(true);
  });

  it("Finish sends the trimmed name, username and roster", async () => {
    vi.mocked(updateMe).mockResolvedValue({
      name: "Player One",
      username: "player.one",
      rosterId: 6,
      createdAt: "2026-09-22T12:00:00+00:00",
      updatedAt: "2026-09-22T12:00:00+00:00",
    });
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);
    await toTeamStep();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText("Pick your team.")).toBeTruthy();
    expect(updateMe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Team 6\b/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(updateMe).toHaveBeenCalledWith({ name: "Player One", username: "player.one", rosterId: 6 });
  });

  it("returns to the username step with the server's error on a username 400", async () => {
    vi.mocked(updateMe).mockRejectedValue(
      new ApiError(400, "username must be 2-20 characters", { field: "username" }),
    );
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);
    await toTeamStep();

    fireEvent.click(screen.getByRole("radio", { name: /Team 3\b/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByRole("heading", { name: "Pick a username" })).toBeTruthy();
    expect(screen.getByText("username must be 2-20 characters")).toBeTruthy();
    expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("player.one");
    expect(onDone).not.toHaveBeenCalled();
  });
});
