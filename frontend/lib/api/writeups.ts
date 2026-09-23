import { ApiError, request } from "./users";

/** `pages` are presigned image URLs, in order, valid for an hour. */
export interface Writeup {
  mediaId: string;
  week: number;
  title: string;
  publishedAt: string;
  pages: string[];
}

export async function getWriteups(): Promise<Writeup[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<Writeup[]>("/writeups/list", { method: "GET" });
}
