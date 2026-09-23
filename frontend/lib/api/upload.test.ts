import { afterEach, describe, expect, it, vi } from "vitest";

import { FakeXhr } from "@/lib/test/xhr-mock";
import { uploadFile } from "./upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadFile", () => {
  it("posts the presigned fields before the file and reports progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const progress: number[] = [];
    const file = new File(["mp4"], "chug.mp4", { type: "video/mp4" });

    const done = uploadFile({ url: "https://bucket.test", fields: { key: "k", "Content-Type": "video/mp4", policy: "p" } }, file, (f) =>
      progress.push(f),
    );
    const xhr = FakeXhr.last;
    xhr.progress(1, 4);
    xhr.progress(3, 4);
    xhr.finish(204);
    await done;

    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("https://bucket.test");
    expect([...xhr.body.keys()]).toEqual(["key", "Content-Type", "policy", "file"]);
    expect(xhr.body.get("file")).toBe(file);
    expect(progress).toEqual([0.25, 0.75]);
  });

  it("rejects when S3 refuses the upload", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const done = uploadFile({ url: "https://bucket.test", fields: {} }, new File(["x"], "a.pdf"), () => {});
    FakeXhr.last.finish(403);
    await expect(done).rejects.toThrow("Upload failed (403)");
  });
});
