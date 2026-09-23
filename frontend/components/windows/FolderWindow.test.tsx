import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DrillContext, NavigateContext } from "@/components/views/drill-link";
import { FolderWindow } from "./FolderWindow";

const APPS = ["Ice Ledger", "Ice Standings", "Ice Stats", "Ice Watch", "Chug Videos"];
const KINDS = ["ices", "ice-standings", "stats", "watch", "videos"];

function renderFolder() {
  const navigate = vi.fn();
  const open = vi.fn();
  render(
    <DrillContext.Provider value={open}>
      <NavigateContext value={navigate}>
        <FolderWindow />
      </NavigateContext>
    </DrillContext.Provider>,
  );
  return { navigate, open, icons: within(screen.getByRole("list", { name: "Ices" })) };
}

describe("Ices folder", () => {
  it("shows the address and a large icon for each of the five ice apps", () => {
    const { icons } = renderFolder();

    expect(screen.getByRole("textbox", { name: "Address" })).toHaveProperty("value", "C:\\Smirnoff\\Ices");
    expect(icons.getAllByRole("button").map((b) => b.textContent)).toEqual(APPS);
  });

  it("opens each app in place on a double-click or Enter, and in a new window on Ctrl-double-click", () => {
    const { navigate, open, icons } = renderFolder();

    for (const name of APPS) fireEvent.doubleClick(icons.getByRole("button", { name }));
    expect(navigate.mock.calls.map(([to]) => to.kind)).toEqual(KINDS);

    fireEvent.click(icons.getByRole("button", { name: "Ice Stats" }), { detail: 0 });
    expect(navigate).toHaveBeenLastCalledWith({ kind: "stats" });

    fireEvent.doubleClick(icons.getByRole("button", { name: "Ice Watch" }), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith({ kind: "watch" });
    expect(navigate).toHaveBeenCalledTimes(6);
  });

  it("opens on a tap's click, once, and ignores a single mouse click", () => {
    const { navigate, icons } = renderFolder();
    const stats = icons.getByRole("button", { name: "Ice Stats" });

    fireEvent.pointerDown(stats, { pointerType: "mouse" });
    fireEvent.pointerUp(stats, { pointerType: "mouse" });
    fireEvent.click(stats, { detail: 1 });
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.pointerDown(stats, { pointerType: "touch" });
    fireEvent.pointerUp(stats, { pointerType: "touch" });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(stats, { detail: 1 });
    expect(navigate).toHaveBeenCalledOnce();
  });
});
