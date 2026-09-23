import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { FakeXhr } from "@/lib/test/xhr-mock";
import { listWriteups, publishWriteup, uploadPdf } from "./writeups";

afterEach(() => {
  vi.unstubAllGlobals();
  fetchAuthSession.mockReset();
});

const envelope = (data: unknown) => new Response(JSON.stringify({ data, error: null, meta: null }));

describe("writeups api", () => {
  it("listWriteups sends the ID token", async () => {
    fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
    const fetchMock = vi.fn(async () => envelope([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listWriteups()).resolves.toEqual([]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/writeups/list");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("Authorization")).toBe("id-token");
  });

  it("publishWriteup posts the media id and flag", async () => {
    fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token" } } });
    const fetchMock = vi.fn(async () => envelope({ mediaId: "W03#a", status: "rendered" }));
    vi.stubGlobal("fetch", fetchMock);

    await publishWriteup("W03#a", true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/admin/writeup-publish");
    expect(JSON.parse(String(init.body))).toEqual({ mediaId: "W03#a", published: true });
  });

  it("uploadPdf posts the presigned fields before the file and reports progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const progress: number[] = [];
    const file = new File(["%PDF"], "week3.pdf", { type: "application/pdf" });

    const done = uploadPdf({ url: "https://bucket.test", fields: { key: "k", policy: "p" } }, file, (f) => progress.push(f));
    const xhr = FakeXhr.last;
    xhr.progress(1, 4);
    xhr.finish(204);
    await done;

    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("https://bucket.test");
    expect([...xhr.body.keys()]).toEqual(["key", "policy", "file"]);
    expect(progress).toEqual([0.25]);
  });

  it("uploadPdf rejects when S3 refuses the upload", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const done = uploadPdf({ url: "https://bucket.test", fields: {} }, new File(["x"], "a.pdf"), () => {});
    FakeXhr.last.finish(403);
    await expect(done).rejects.toThrow("Upload failed (403)");
  });
});
