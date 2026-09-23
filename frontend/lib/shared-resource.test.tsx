import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ledger")>()),
  getLedger: vi.fn(),
}));
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  listVideos: vi.fn(),
}));

import { getLedger, type Ledger } from "@/lib/api/ledger";
import { listVideos, type Video } from "@/lib/api/videos";
import { refreshLedger, useLedger } from "@/lib/ices/use-ledger";
import { useVideos } from "@/lib/videos/use-videos";

const ledger = (week: number): Ledger => ({ ices: [], weeks: [{ week, finalizedAt: null, deadlineUtc: null }], summary: [] });
const video = (mediaId: string): Video => ({ mediaId, iceIds: [], week: 1, rosterIds: [], createdAt: "", bytes: 1, url: `https://media.test/${mediaId}` });

const twoLedgers = () => renderHook(() => [useLedger(), useLedger()] as const);
const weekOf = (s: ReturnType<typeof useLedger>) => (s.status === "ok" ? s.ledger.weeks[0].week : s.status);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T22:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("shared ledger", () => {
  it("serves concurrent callers from one request", async () => {
    vi.mocked(getLedger).mockResolvedValue(ledger(1));
    const { result } = twoLedgers();
    await waitFor(() => expect(result.current.map(weekOf)).toEqual([1, 1]));
    renderHook(() => useLedger());
    expect(getLedger).toHaveBeenCalledTimes(1);
  });

  it("refetches once on refresh and updates every subscriber", async () => {
    vi.mocked(getLedger).mockResolvedValue(ledger(1));
    const { result } = twoLedgers();
    await waitFor(() => expect(result.current.map(weekOf)).toEqual([1, 1]));

    vi.mocked(getLedger).mockResolvedValue(ledger(2));
    act(() => refreshLedger());
    await waitFor(() => expect(result.current.map(weekOf)).toEqual([2, 2]));
    expect(getLedger).toHaveBeenCalledTimes(2);
  });

  it("drops a failed request so the next caller retries", async () => {
    vi.mocked(getLedger).mockRejectedValueOnce(new Error("boom")).mockResolvedValue(ledger(3));
    const first = renderHook(() => useLedger());
    await waitFor(() => expect(first.result.current).toEqual({ status: "error", message: "boom" }));
    first.unmount();

    const again = renderHook(() => useLedger());
    await waitFor(() => expect(weekOf(again.result.current)).toBe(3));
    expect(getLedger).toHaveBeenCalledTimes(2);
  });

  it("ignores a response that a refresh has superseded", async () => {
    let finishOld: (l: Ledger) => void = () => {};
    vi.mocked(getLedger)
      .mockReturnValueOnce(new Promise((resolve) => (finishOld = resolve)))
      .mockResolvedValue(ledger(2));
    const { result } = renderHook(() => useLedger());
    act(() => refreshLedger());
    await waitFor(() => expect(weekOf(result.current)).toBe(2));
    await act(async () => finishOld(ledger(1)));
    expect(weekOf(result.current)).toBe(2);
  });
});

describe("shared videos", () => {
  const ids = (s: ReturnType<typeof useVideos>["state"]) => (s.status === "ok" ? s.videos.map((v) => v.mediaId) : s.status);

  it("refetches a list old enough for its presigned URLs to expire", async () => {
    vi.mocked(listVideos).mockResolvedValue([video("a")]);
    const first = renderHook(() => useVideos());
    await waitFor(() => expect(ids(first.result.current.state)).toEqual(["a"]));
    first.unmount();

    vi.setSystemTime(new Date("2026-09-25T22:30:00Z"));
    renderHook(() => useVideos());
    expect(listVideos).toHaveBeenCalledTimes(1);

    vi.mocked(listVideos).mockResolvedValue([video("b")]);
    vi.setSystemTime(new Date("2026-09-25T22:51:00Z"));
    const late = renderHook(() => useVideos());
    await waitFor(() => expect(ids(late.result.current.state)).toEqual(["b"]));
    expect(listVideos).toHaveBeenCalledTimes(2);
  });

  it("refetches on a player error only once the list is a minute old", async () => {
    vi.mocked(listVideos).mockResolvedValue([video("a")]);
    const { result } = renderHook(() => [useVideos(), useVideos()] as const);
    await waitFor(() => expect(ids(result.current[0].state)).toEqual(["a"]));

    act(() => result.current[0].onVideoError());
    expect(listVideos).toHaveBeenCalledTimes(1);

    vi.mocked(listVideos).mockResolvedValue([video("b")]);
    vi.setSystemTime(new Date("2026-09-25T22:02:00Z"));
    act(() => {
      result.current[0].onVideoError();
      result.current[1].onVideoError();
    });
    await waitFor(() => expect(result.current.map((r) => ids(r.state))).toEqual([["b"], ["b"]]));
    expect(listVideos).toHaveBeenCalledTimes(2);
  });
});
