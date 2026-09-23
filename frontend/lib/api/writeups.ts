import { ApiError, request } from "./users";

export interface Writeup {
  mediaId: string;
  week: number;
  title: string;
  publishedAt: string;
  /** Presigned WebP GETs in page order; they expire an hour after the list call. */
  pages: string[];
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface WriteupStatus {
  mediaId: string;
  status: "pending" | "rendered" | "failed";
  publishedAt?: string;
}

export async function listWriteups(): Promise<Writeup[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<Writeup[]>("/writeups/list", { method: "GET" });
}

export const presignWriteup = (input: { week: number; title: string }) =>
  request<PresignedPost & { mediaId: string }>("/admin/writeup-presign", { method: "POST", body: JSON.stringify(input) });

// Returns the whole row, status included. With no admin status endpoint,
// unpublishing a fresh upload doubles as the render-status poll.
export const publishWriteup = (mediaId: string, published: boolean) =>
  request<WriteupStatus>("/admin/writeup-publish", { method: "POST", body: JSON.stringify({ mediaId, published }) });

// XHR rather than fetch, which reports no upload progress.
export function uploadPdf(post: PresignedPost, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(post.fields)) form.append(key, value);
    // S3 ignores every field after the file.
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new ApiError(0, "Upload failed (network)"));
    xhr.open("POST", post.url);
    xhr.send(form);
  });
}
