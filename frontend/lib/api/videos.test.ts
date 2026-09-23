import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { confirmVideo, listVideos, presignVideo } from "./videos";

afterEach(() => {
  vi.unstubAllGlobals();
  fetchAuthSession.mockReset();
});

const envelope = (data: unknown, status = 200, error: unknown = null) =>
  new Response(JSON.stringify({ data, error, meta: null }), { status });

function stubFetch(response: Response) {
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

describe("videos api", () => {
  it("listVideos sends the ID token", async () => {
    const call = stubFetch(envelope([]));
    await expect(listVideos()).resolves.toEqual([]);
    const [url, init] = call();
    expect(url).toBe("https://api.test/videos/list");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("id-token");
  });

  it("presignVideo posts the ices, type and size", async () => {
    const call = stubFetch(envelope({ mediaId: "W02#a", url: "https://bucket.test", fields: {} }));
    await presignVideo({ iceIds: ["W02#R13#LOWEST", "W02#R12#S1"], contentType: "video/mp4", bytes: 1024 });
    const [url, init] = call();
    expect(url).toBe("https://api.test/videos/presign");
    expect(JSON.parse(String(init.body))).toEqual({ iceIds: ["W02#R13#LOWEST", "W02#R12#S1"], contentType: "video/mp4", bytes: 1024 });
  });

  it("confirmVideo surfaces a 409 with its status", async () => {
    const call = stubFetch(envelope(null, 409, { handler: "videos_confirm", message: "The upload has not landed in S3" }));
    await expect(confirmVideo("W02#a")).rejects.toMatchObject({ status: 409 });
    expect(JSON.parse(String(call()[1].body))).toEqual({ mediaId: "W02#a" });
  });
});
