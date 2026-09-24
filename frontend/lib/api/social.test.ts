import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { deleteComment, getSocial, postComment, recentComments, toggleReaction } from "./social";

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

describe("social api", () => {
  it("getSocial encodes the # in the video id", async () => {
    const call = stubFetch(envelope({ reactions: {}, comments: [] }));
    await getSocial("W02#abc");
    expect(call()[0]).toBe("https://api.test/videos/social?videoId=W02%23abc");
  });

  it.each([
    ["toggleReaction", () => toggleReaction("W02#a", "crown"), "/videos/react", { videoId: "W02#a", type: "crown" }],
    ["postComment", () => postComment("W02#a", "cold"), "/videos/comment", { videoId: "W02#a", text: "cold" }],
    ["deleteComment", () => deleteComment("W02#a", "c1"), "/videos/comment-delete", { videoId: "W02#a", commentId: "c1" }],
  ])("%s posts its body", async (_, send, path, body) => {
    const call = stubFetch(envelope({ reactions: {}, comments: [] }));
    await send();
    const [url, init] = call();
    expect(url).toBe(`https://api.test${path}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("postComment surfaces a 429 with its message", async () => {
    stubFetch(envelope(null, 429, { handler: "videos_comment", message: "Slow down" }));
    await expect(postComment("W02#a", "x")).rejects.toMatchObject({ status: 429, message: "Slow down" });
  });

  it("recentComments reads the feed", async () => {
    const call = stubFetch(envelope([]));
    await expect(recentComments()).resolves.toEqual([]);
    expect(call()[0]).toBe("https://api.test/videos/social-recent");
  });
});
