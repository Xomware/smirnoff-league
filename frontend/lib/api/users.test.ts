import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { ApiError, getMe, updateMe } from "./users";

const PROFILE = {
  name: "Player One",
  username: "player.one",
  rosterId: 7,
  createdAt: "2026-09-22T12:00:00+00:00",
  updatedAt: "2026-09-22T12:00:00+00:00",
};

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  fetchAuthSession.mockResolvedValue({
    tokens: {
      idToken: { toString: () => "id-token" },
      accessToken: { toString: () => "access-token" },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchAuthSession.mockReset();
});

describe("users api", () => {
  it("getMe sends the ID token and returns the envelope data", async () => {
    const me = { sub: "abc", email: "player@example.com", profile: null, isAdmin: false };
    const fetchMock = respond(200, { data: me, error: null, meta: null });

    await expect(getMe()).resolves.toEqual(me);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/users/me");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("id-token");
  });

  it("updateMe posts the profile and returns the saved one", async () => {
    const fetchMock = respond(200, { data: PROFILE, error: null, meta: null });

    const input = { name: "Player One", username: "player.one", rosterId: 7 };
    await expect(updateMe(input)).resolves.toEqual(PROFILE);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/users/update");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(new Headers(init.headers).get("Authorization")).toBe("id-token");
  });

  it("throws the envelope error", async () => {
    respond(400, {
      data: null,
      error: { handler: "users_update", message: "rosterId must be a whole number from 1 to 14", detail: { field: "rosterId" } },
      meta: null,
    });

    const err = await updateMe({ name: "x", username: "xx", rosterId: 99 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      message: "rosterId must be a whole number from 1 to 14",
      detail: { field: "rosterId" },
    });
  });

  it("throws without calling the API when signed out", async () => {
    fetchAuthSession.mockResolvedValue({ tokens: undefined });
    const fetchMock = respond(200, {});

    await expect(getMe()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
