import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/writeups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/writeups")>()),
  listWriteups: vi.fn(),
  presignWriteup: vi.fn(),
  publishWriteup: vi.fn(),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getMe: vi.fn(),
}));

import { Desktop } from "@/components/desktop/Desktop";
import { getMe, type Me } from "@/lib/api/users";
import { listWriteups, presignWriteup, publishWriteup, type Writeup } from "@/lib/api/writeups";
import { DesktopProvider } from "@/lib/desktop/desktop-context";
import { ProfileProvider } from "@/lib/profile/use-profile";
import { stubSleeper } from "@/lib/test/league-mock";
import { FakeXhr } from "@/lib/test/xhr-mock";
import { WriteupWindow } from "./WriteupWindow";

const pages = (id: string, n: number) => Array.from({ length: n }, (_, i) => `https://media.test/${id}/p${i + 1}.webp`);
const WRITEUPS: Writeup[] = [
  { mediaId: "W03#c", week: 3, title: "Iced Out", publishedAt: "2026-09-22T12:00:00+00:00", pages: pages("c", 3) },
  { mediaId: "W02#b", week: 2, title: "Chug Season", publishedAt: "2026-09-15T12:00:00+00:00", pages: pages("b", 2) },
];

function me(isAdmin: boolean): Me {
  const profile = { name: "N", username: "u", rosterId: 6, createdAt: "", updatedAt: "" };
  return { sub: "s", email: "e", profile, isAdmin };
}

function renderWindow(params: { week?: number } = {}, isAdmin = false) {
  vi.mocked(getMe).mockResolvedValue(me(isAdmin));
  return render(
    <ProfileProvider>
      <WriteupWindow params={params} />
    </ProfileProvider>,
  );
}

const pageSrcs = (root: HTMLElement) =>
  within(within(root).getByRole("list", { name: "Pages" }))
    .getAllByRole("img")
    .map((img) => img.getAttribute("src"));

beforeEach(() => {
  stubSleeper();
  vi.mocked(listWriteups).mockResolvedValue(WRITEUPS);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Write-up window", () => {
  it("renders the latest edition's pages in order, lazy and sized", async () => {
    const { container } = renderWindow();
    expect(await screen.findByRole("heading", { name: "Iced Out" })).toBeTruthy();
    expect(pageSrcs(container)).toEqual(pages("c", 3));
    const second = screen.getByRole("img", { name: "Page 2 of 3" });
    expect(second.getAttribute("loading")).toBe("lazy");
    expect(second.getAttribute("width")).toBeTruthy();
    expect(second.getAttribute("height")).toBeTruthy();
  });

  it("shows the requested week", async () => {
    const { container } = renderWindow({ week: 2 });
    expect(await screen.findByRole("heading", { name: "Chug Season" })).toBeTruthy();
    expect(pageSrcs(container)).toEqual(pages("b", 2));
  });

  it("shows the empty state when nothing is published", async () => {
    vi.mocked(listWriteups).mockResolvedValue([]);
    renderWindow();
    expect(await screen.findByText("No edition yet. The commish is typing...")).toBeTruthy();
  });

  it("refetches the list when a page URL has expired", async () => {
    renderWindow();
    const page = await screen.findByRole("img", { name: "Page 1 of 3" });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    fireEvent.error(page);
    await waitFor(() => expect(listWriteups).toHaveBeenCalledTimes(2));
  });

  it("hides the admin controls from non-admins", async () => {
    renderWindow();
    await screen.findByRole("heading", { name: "Iced Out" });
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Upload edition" })).toBeNull();
  });

  it("uploads with progress, waits for the render, then publishes", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    vi.mocked(presignWriteup).mockResolvedValue({ mediaId: "W04#d", url: "https://bucket.test", fields: { key: "k" } });
    vi.mocked(publishWriteup)
      .mockResolvedValueOnce({ mediaId: "W04#d", status: "pending" })
      .mockResolvedValueOnce({ mediaId: "W04#d", status: "rendered" })
      .mockResolvedValueOnce({ mediaId: "W04#d", status: "rendered", publishedAt: "2026-09-29T12:00:00+00:00" });
    renderWindow({}, true);
    fireEvent.click(await screen.findByRole("button", { name: "Upload edition" }));

    const dialog = screen.getByRole("dialog", { name: "Upload edition" });
    expect((within(dialog).getByLabelText("Week") as HTMLInputElement).value).toBe("4");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Frozen Four" } });
    const pdf = new File(["%PDF"], "w4.pdf", { type: "application/pdf" });
    fireEvent.change(within(dialog).getByLabelText("PDF"), { target: { files: [pdf] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(FakeXhr.last?.url).toBe("https://bucket.test"));
    expect(presignWriteup).toHaveBeenCalledWith({ week: 4, title: "Frozen Four" });
    expect(FakeXhr.last.body.get("file")).toBe(pdf);
    act(() => FakeXhr.last.progress(1, 2));
    expect(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => FakeXhr.last.finish(204));
    expect(await within(dialog).findByText(/rendering pages/i)).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(publishWriteup).toHaveBeenLastCalledWith("W04#d", false);

    fireEvent.click(await within(dialog).findByRole("button", { name: "Publish" }));
    expect(await within(dialog).findByRole("button", { name: "Unpublish" })).toBeTruthy();
    expect(publishWriteup).toHaveBeenLastCalledWith("W04#d", true);
    await waitFor(() => expect(listWriteups).toHaveBeenCalledTimes(2));
  });

  it("says so clearly when the render fails", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    vi.mocked(presignWriteup).mockResolvedValue({ mediaId: "W04#d", url: "https://bucket.test", fields: {} });
    vi.mocked(publishWriteup).mockResolvedValue({ mediaId: "W04#d", status: "failed" });
    renderWindow({}, true);
    fireEvent.click(await screen.findByRole("button", { name: "Upload edition" }));
    const dialog = screen.getByRole("dialog", { name: "Upload edition" });
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Broken" } });
    fireEvent.change(within(dialog).getByLabelText("PDF"), { target: { files: [new File(["x"], "b.pdf", { type: "application/pdf" })] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(FakeXhr.last?.body.get("file")).toBeTruthy());
    act(() => FakeXhr.last.finish(204));

    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/could not be rendered/i);
    expect(within(dialog).queryByRole("button", { name: "Publish" })).toBeNull();
  });
});

describe("scenario: the week's edition", () => {
  it("shows the latest beside Home, 3 pages, then an older week from the archive", async () => {
    vi.mocked(getMe).mockResolvedValue(me(false));
    render(
      <ProfileProvider>
        <DesktopProvider>
          <Desktop />
        </DesktopProvider>
      </ProfileProvider>,
    );
    const win = document.querySelector<HTMLElement>('section[aria-label="Smirnoff League - Latest Edition"]')!;
    expect(await within(win).findByRole("heading", { name: "Iced Out" })).toBeTruthy();
    expect(pageSrcs(win)).toEqual(pages("c", 3));
    expect(screen.queryByRole("region", { name: "This Week's Edition" })).toBeNull();

    fireEvent.click(within(within(win).getByRole("navigation", { name: "Archive" })).getByRole("button", { name: /week 2/i }));

    expect(win.getAttribute("aria-label")).toBe("Smirnoff League - Week 2 Edition");
    expect(await within(win).findByRole("heading", { name: "Chug Season" })).toBeTruthy();
    expect(pageSrcs(win)).toEqual(pages("b", 2));
  });
});
