import { ApiError, request } from "./users";

export const REACTIONS = ["glacier", "stopwatch", "bottle", "siren", "crown"] as const;
export type ReactionType = (typeof REACTIONS)[number];

export interface Reaction {
  count: number;
  mine: boolean;
  by: string[];
}

export interface Author {
  rosterId: number | null;
  displayName: string | null;
}

export interface VideoComment {
  id: string;
  author: Author;
  text: string;
  createdAt: string;
  mine: boolean;
}

export interface VideoSocial {
  reactions: Record<ReactionType, Reaction>;
  /** Oldest first. */
  comments: VideoComment[];
}

export interface RecentComment {
  videoId: string;
  week: number;
  id: string;
  author: Author;
  text: string;
  createdAt: string;
}

export const MAX_COMMENT = 280;

const post = (path: string, body: object) => request<VideoSocial>(path, { method: "POST", body: JSON.stringify(body) });

export const getSocial = (videoId: string) =>
  request<VideoSocial>(`/videos/social?videoId=${encodeURIComponent(videoId)}`, { method: "GET" });

export const toggleReaction = (videoId: string, type: ReactionType) => post("/videos/react", { videoId, type });

export const postComment = (videoId: string, text: string) => post("/videos/comment", { videoId, text });

export const deleteComment = (videoId: string, commentId: string) => post("/videos/comment-delete", { videoId, commentId });

/** Others' comments on the caller's chugs, newest first. */
export async function recentComments(): Promise<RecentComment[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) throw new ApiError(0, "API not configured");
  return request<RecentComment[]>("/videos/social-recent", { method: "GET" });
}
