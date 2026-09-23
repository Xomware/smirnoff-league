import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { getLedger } from "./ledger";

afterEach(() => {
  vi.unstubAllGlobals();
  fetchAuthSession.mockReset();
});

describe("ledger api", () => {
  it("getLedger sends the ID token and returns the envelope data", async () => {
    fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
    const ledger = { ices: [], weeks: [{ week: 1, finalizedAt: null, deadlineUtc: null }], summary: [] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: ledger, error: null, meta: null })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLedger()).resolves.toEqual(ledger);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/ledger/get");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("id-token");
  });
});
