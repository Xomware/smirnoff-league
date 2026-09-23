import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "./page";

describe("privacy page", () => {
  it("covers the Google user data disclosures brand verification asks for", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    const sections = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual([
      "Google user data we access",
      "How we use Google user data",
      "Other data we keep",
      "Who we share it with",
      "How we protect it",
      "Emails",
      "How long we keep it, and deleting it",
      "Changes to this policy",
      "Contact",
    ]);
    expect(screen.getByText(/us-east-1/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Google API Services User Data Policy" })).toBeTruthy();
    expect(screen.getByText(/unsubscribe link/i)).toBeTruthy();
    expect(screen.getByText(/2026-09-23/)).toBeTruthy();
  });
});
