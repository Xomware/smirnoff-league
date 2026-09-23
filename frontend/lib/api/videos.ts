import type { PresignedPost } from "./upload";
import { ApiError, request } from "./users";

export interface Video {
  mediaId: string;
  iceId: string;
  week: number;
  rosterId: number;
  uploaderName?: string | null;
  createdAt: string;
  bytes: number;
  /** Presigned GET; it expires an hour after the list call. */
  url: string;
}

// The server enforces the same cap through the presigned POST policy.
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export async function listVideos(): Promise<Video[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<Video[]>("/videos/list", { method: "GET" });
}

export const presignVideo = (input: { iceId: string; contentType: string; bytes: number }) =>
  request<PresignedPost & { mediaId: string }>("/videos/presign", { method: "POST", body: JSON.stringify(input) });

export const confirmVideo = async (mediaId: string): Promise<void> => {
  await request("/videos/confirm", { method: "POST", body: JSON.stringify({ mediaId }) });
};
