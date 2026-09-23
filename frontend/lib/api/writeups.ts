import type { PresignedPost } from "./upload";
import { ApiError, request } from "./users";

export interface Writeup {
  mediaId: string;
  week: number;
  title: string;
  publishedAt: string;
  /** Presigned WebP GETs in page order; they expire an hour after the list call. */
  pages: string[];
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
