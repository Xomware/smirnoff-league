import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertsProvider, useAlerts } from "./alerts";

function Harness({ onResult }: { onResult?: (label: string | null) => void }) {
  const { notify, alert } = useAlerts();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          notify({ title: "You've got ice!", body: "Team 6 owes one." });
          notify({ title: "New week", body: "Week 3 is live." });
        }}
      >
        two balloons
      </button>
      <button
        type="button"
        onClick={() =>
          void alert({
            kind: "error",
            title: "ICE.EXE",
            body: "ICE.EXE has encountered a problem and needs to close.",
            buttons: ["OK", "Cancel"],
          }).then(onResult)
        }
      >
        open dialog
      </button>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("balloons", () => {
  it("shows one balloon at a time and auto-dismisses each", () => {
    vi.useFakeTimers();
    render(
      <AlertsProvider>
        <Harness />
      </AlertsProvider>,
    );
    fireEvent.click(screen.getByText("two balloons"));

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toMatch(/you've got ice/i);

    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toMatch(/new week/i);

    act(() => vi.advanceTimersByTime(8000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("closes on the X", () => {
    render(
      <AlertsProvider>
        <Harness />
      </AlertsProvider>,
    );
    fireEvent.click(screen.getByText("two balloons"));
    fireEvent.click(screen.getByRole("button", { name: /close notification/i }));

    expect(screen.getByRole("status").textContent).toMatch(/new week/i);
  });
});

describe("dialog", () => {
  it("traps focus inside and closes on Escape", async () => {
    const onResult = vi.fn();
    render(
      <AlertsProvider>
        <Harness onResult={onResult} />
      </AlertsProvider>,
    );
    const opener = screen.getByText("open dialog");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("alertdialog", { name: "ICE.EXE" });
    const ok = screen.getByRole("button", { name: "OK" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(ok);

    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Tab" });
    expect(document.activeElement).toBe(ok);
    fireEvent.keyDown(ok, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(null));
  });

  it("resolves with the clicked button", async () => {
    const onResult = vi.fn();
    render(
      <AlertsProvider>
        <Harness onResult={onResult} />
      </AlertsProvider>,
    );
    fireEvent.click(screen.getByText("open dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith("Cancel"));
  });
});
