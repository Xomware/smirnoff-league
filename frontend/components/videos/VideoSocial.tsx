"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { timeAgo } from "@/lib/news/feed";
import {
  deleteComment,
  getSocial,
  MAX_COMMENT,
  postComment,
  REACTIONS,
  type ReactionType,
  toggleReaction,
  type VideoComment,
  type VideoSocial as Social,
} from "@/lib/api/social";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { REACTION_ICONS, REACTION_LABELS } from "./reaction-icons";

import "./social.css";

const SHOWN = 3;
const LONG_PRESS_MS = 450;

function withReaction(social: Social, type: ReactionType, name: string): Social {
  const r = social.reactions[type];
  const at = r.by.indexOf(name);
  const next = r.mine
    ? { count: r.count - 1, mine: false, by: at < 0 ? r.by : [...r.by.slice(0, at), ...r.by.slice(at + 1)] }
    : { count: r.count + 1, mine: true, by: [...r.by, name] };
  return { ...social, reactions: { ...social.reactions, [type]: next } };
}

const who = (by: string[]) => (by.length ? by.join(", ") : "Nobody yet");

export function VideoSocial({ videoId }: { videoId: string }) {
  const { me, myRosterId } = useProfile();
  const { teamFor } = useLeague();
  const [social, setSocial] = useState<Social | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [peek, setPeek] = useState<ReactionType | null>(null);
  const press = useRef<{ timer: number; long: boolean } | null>(null);
  const tmp = useRef(0);
  const [now] = useState(Date.now);
  const name = me?.profile?.name ?? "You";
  const isAdmin = me?.isAdmin ?? false;

  useEffect(() => {
    let live = true;
    getSocial(videoId).then(
      (s) => live && setSocial(s),
      (e: Error) => live && setError(`Could not load reactions (${e.message}).`),
    );
    return () => {
      live = false;
    };
  }, [videoId]);

  if (!social) {
    return error ? (
      <p role="alert" className="social-error">
        {error}
      </p>
    ) : null;
  }

  // Optimistic: show the change now, take the server's copy after, put the old one back on failure.
  const run = async (next: Social, send: () => Promise<Social>, failed: string, undo?: () => void) => {
    const before = social;
    setSocial(next);
    setError(null);
    try {
      setSocial(await send());
    } catch (e) {
      setSocial(before);
      undo?.();
      setError(`${failed} (${(e as Error).message}).`);
    }
  };

  const react = (type: ReactionType) => {
    if (press.current?.long) return;
    run(withReaction(social, type, name), () => toggleReaction(videoId, type), "Could not react");
  };

  const startPress = (type: ReactionType) => {
    const timer = window.setTimeout(() => {
      if (press.current) press.current.long = true;
      setPeek(type);
    }, LONG_PRESS_MS);
    press.current = { timer, long: false };
  };
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };

  const text = draft.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text || text.length > MAX_COMMENT) return;
    const pending: VideoComment = {
      id: `pending-${tmp.current++}`,
      author: { rosterId: myRosterId, displayName: name },
      text,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    setDraft("");
    run({ ...social, comments: [...social.comments, pending] }, () => postComment(videoId, text), "Could not post", () => setDraft(draft));
  };

  const remove = (c: VideoComment) =>
    run({ ...social, comments: social.comments.filter((x) => x.id !== c.id) }, () => deleteComment(videoId, c.id), "Could not delete");

  const { comments } = social;
  const shown = showAll ? comments : comments.slice(-SHOWN);

  return (
    <section className="xp-group video-social" aria-label="Reactions and comments">
      <div className="social-reactions" role="group" aria-label="Reactions">
        {REACTIONS.map((type) => {
          const r = social.reactions[type];
          const Icon = REACTION_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              className="xp-button social-react"
              aria-pressed={r.mine}
              aria-label={`${REACTION_LABELS[type]}, ${r.count}`}
              title={`${REACTION_LABELS[type]}: ${who(r.by)}`}
              onClick={() => react(type)}
              onPointerDown={() => startPress(type)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Icon width={18} height={18} />
              <span>{r.count}</span>
            </button>
          );
        })}
      </div>
      {peek && (
        <div className="social-peek" role="status">
          <strong>{REACTION_LABELS[peek]}:</strong> {who(social.reactions[peek].by)}
          <button
            type="button"
            className="xp-button social-small"
            onClick={() => setPeek(null)}
          >
            Close
          </button>
        </div>
      )}

      {comments.length > SHOWN && !showAll && (
        <button type="button" className="social-more" onClick={() => setShowAll(true)}>
          View all {comments.length} comments
        </button>
      )}
      {shown.length > 0 && (
        <ul className="social-comments" aria-label="Comments">
          {shown.map((c) => {
            const team = c.author.rosterId === null ? null : teamFor(c.author.rosterId);
            return (
              <li key={c.id} className="social-comment" aria-busy={c.id.startsWith("pending-")}>
                {team?.avatarUrl ? <Image src={team.avatarUrl} alt="" width={28} height={28} unoptimized className="social-avatar" /> : <span className="social-avatar" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="social-byline">
                    <strong>{c.author.displayName ?? team?.name ?? "Unknown"}</strong>
                    <span className="social-when">{timeAgo(Date.parse(c.createdAt), now)}</span>
                  </p>
                  <p className="social-text">{c.text}</p>
                </div>
                {(c.mine || isAdmin) && !c.id.startsWith("pending-") && (
                  <button type="button" className="xp-button social-small" aria-label={`Delete comment: ${c.text}`} onClick={() => remove(c)}>
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form className="social-compose" onSubmit={submit}>
        <textarea
          className="xp-input social-input"
          aria-label="Add a comment"
          placeholder="Add a comment"
          rows={2}
          maxLength={MAX_COMMENT}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <span className="social-count">
          {draft.length}/{MAX_COMMENT}
        </span>
        <button type="submit" className="xp-button" disabled={!text}>
          Post
        </button>
      </form>
      {error && (
        <p role="alert" className="social-error">
          {error}
        </p>
      )}
    </section>
  );
}
