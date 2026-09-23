import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "./page";

describe("privacy page", () => {
  it("covers what is collected, where it lives, emails and deletion", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    const sections = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual(["What we collect", "Where it lives", "Emails", "Deleting your data", "Contact"]);
    expect(screen.getByText(/us-east-1/)).toBeTruthy();
    expect(screen.getByText(/unsubscribe link/i)).toBeTruthy();
    expect(screen.getByText(/2026-09-23/)).toBeTruthy();
  });
});
