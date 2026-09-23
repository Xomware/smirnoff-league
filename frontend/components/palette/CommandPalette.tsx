"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ChugTimeDialog } from "@/components/videos/ChugTime";
import { iceLabel } from "@/components/videos/ice-label";
import { UploadChug } from "@/components/videos/UploadChug";
import { CloseGlyph, SearchIcon } from "@/components/xp/icons";
import { useAlerts } from "@/lib/alerts/alerts";
import type { LedgerIce } from "@/lib/api/ledger";
import { useAuth } from "@/lib/auth/use-auth";
import { useLedger } from "@/lib/ices/use-ledger";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";
import { bestScore, rank, SCATTER } from "@/lib/search/fuzzy";
import { loadRecents, saveRecent } from "@/lib/search/recents";
import { isMuted, play, setMuted } from "@/lib/sound/sound";
import { type Destination, GROUPS, type PaletteItem, usePaletteItems } from "./items";

import "./palette.css";

const CAP = 8;

interface Section {
  group: string;
  items: PaletteItem[];
}

// With no query: recent picks, then the pages and actions. With one, each
// group's best few, the group holding the best match first so Enter takes it.
function sections(query: string, items: PaletteItem[], recents: string[]): Section[] {
  if (!query.trim()) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const recent = recents.flatMap((id) => byId.get(id) ?? []);
    const rest = items.filter((i) => (i.group === "Pages" || i.group === "Actions") && !recent.includes(i));
    return [
      { group: "Recent", items: recent },
      { group: "Pages", items: rest.filter((i) => i.group === "Pages") },
      { group: "Actions", items: rest.filter((i) => i.group === "Actions") },
    ].filter((s) => s.items.length > 0);
  }
  const min = bestScore(query, items) > SCATTER ? SCATTER + 1 : 1;
  return GROUPS.map((group) => ({ group, items: rank(query, items.filter((i) => i.group === group), min).slice(0, CAP) }))
    .filter((s) => s.items.length > 0)
    .sort((a, b) => bestScore(query, b.items) - bestScore(query, a.items));
}

interface PaletteBoxProps {
  phone: boolean;
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
}

function PaletteBox({ phone, onPick, onClose }: PaletteBoxProps) {
  const items = usePaletteItems();
  const [recents] = useState(loadRecents);
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const shown = sections(query, items, recents);
  const flat = shown.flatMap((s) => s.items);
  const index = Math.min(at, flat.length - 1);
  const current = flat[index];
  const optionId = (i: number) => `${id}-option-${i}`;

  // Read during the first render: by the time an effect runs, autoFocus has moved focus to the input.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => () => opener?.focus(), [opener]);

  useEffect(() => {
    document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
  });

  const onInputKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && current) {
      e.preventDefault();
      return onPick(current);
    }
    if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || flat.length === 0) return;
    e.preventDefault();
    setAt((index + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
  };

  const onBoxKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? [])];
    const edge = e.shiftKey ? all[0] : all[all.length - 1];
    if (document.activeElement !== edge) return;
    e.preventDefault();
    (e.shiftKey ? all[all.length - 1] : all[0]).focus();
  };

  const input = (
    <input
      id={`${id}-input`}
      type="text"
      role="combobox"
      className="palette-input"
      autoFocus
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="go"
      placeholder="Pages, teams, players, games"
      aria-expanded={flat.length > 0}
      aria-controls={`${id}-list`}
      aria-autocomplete="list"
      aria-activedescendant={current ? optionId(index) : undefined}
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        setAt(0);
      }}
      onKeyDown={onInputKey}
    />
  );

  const results = (
    <>
      <div id={`${id}-list`} role="listbox" aria-label="Results" className="palette-list">
        {shown.map(({ group, items }) => (
          <div key={group} role="group" aria-labelledby={`${id}-${group}`}>
            <div role="presentation" id={`${id}-${group}`} className="palette-group">
              {group}
            </div>
            {items.map((item) => {
              const i = flat.indexOf(item);
              const { Icon } = item;
              return (
                <div
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === index}
                  className="palette-option"
                  // Keeps focus, and so the active descendant, in the input.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== index && setAt(i)}
                  onClick={() => onPick(item)}
                >
                  <span className="palette-icon">
                    <Icon width={24} height={24} />
                  </span>
                  <span className="palette-label">{item.label}</span>
                  {item.hint && <span className="palette-hint">{item.hint}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {flat.length === 0 && <p className="palette-empty">No matches for &ldquo;{query.trim()}&rdquo;.</p>}
      <p role="status" className="sr-only">
        {query.trim() && `${flat.length} ${flat.length === 1 ? "result" : "results"}`}
      </p>
    </>
  );

  if (phone) {
    return (
      <div ref={box} role="dialog" aria-modal="true" aria-label="Search" className="palette palette-sheet" onKeyDown={onBoxKey}>
        <div className="palette-sheet-bar">
          <span className="palette-sheet-field">
            <SearchIcon width={20} height={20} className="shrink-0" />
            <label htmlFor={`${id}-input`} className="sr-only">
              Search
            </label>
            {input}
          </span>
          <button type="button" className="palette-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="palette-sheet-body">{results}</div>
      </div>
    );
  }

  return (
    // A click outside the box closes it, like clicking off a menu.
    <div className="xp-backdrop palette-backdrop" data-no-snowball onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="xp-dialog palette palette-run" onKeyDown={onBoxKey}>
        <div className="xp-dialog-title palette-title">
          <h2 id={`${id}-title`}>Search</h2>
          <button type="button" className="xp-control xp-control-close" aria-label="Close" onClick={onClose}>
            <CloseGlyph width={12} height={12} />
          </button>
        </div>
        <div className="palette-run-body">
          <p className="palette-intro">
            <SearchIcon width={32} height={32} className="shrink-0" />
            Type the name of a page, team, player or game, and it will open for you.
          </p>
          <label className="palette-field">
            <span className="font-bold">Search</span>
            {input}
          </label>
          {results}
        </div>
        <div className="xp-message-buttons palette-buttons">
          <button type="button" className="xp-button" disabled={!current} onClick={() => current && onPick(current)}>
            OK
          </button>
          <button type="button" className="xp-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (to: Destination) => void;
  phone: boolean;
}

export function CommandPalette({ open, onOpenChange, onGo, phone }: CommandPaletteProps) {
  const ledger = useLedger();
  const { data, teamFor } = useLeague();
  const { myRosterId } = useProfile();
  const { signOut } = useAuth();
  const { alert } = useAlerts();
  const [upload, setUpload] = useState<string[] | null>(null);
  const [timing, setTiming] = useState<LedgerIce | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]");
      if (typing && !(e.target as Element).closest(".palette")) return;
      // Otherwise the browser takes Ctrl+K to its own search bar.
      e.preventDefault();
      onOpenChange(!open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const withLedger = (then: (ices: LedgerIce[]) => void) => {
    if (ledger.status === "ok") return then(ledger.ledger.ices);
    const body = ledger.status === "loading" ? "The ledger is still loading. Try again in a moment." : `The ledger is unavailable (${ledger.message}).`;
    void alert({ kind: "error", title: "Ice Ledger", body });
  };

  const pick = (item: PaletteItem) => {
    saveRecent(item.id);
    onOpenChange(false);
    const { target } = item;
    switch (target.type) {
      case "view":
        return onGo(target);
      case "mute": {
        const muted = isMuted();
        setMuted(!muted);
        if (muted) play("ding");
        return;
      }
      case "signout":
        return void signOut();
      case "upload":
        // One video covers one week, so the oldest owed week comes ticked.
        return withLedger((ices) => {
          const owed = ices.filter((i) => i.rosterId === myRosterId && i.status === "owed").sort((a, b) => a.week - b.week);
          setUpload(owed.filter((i) => i.week === owed[0].week).map((i) => i.iceId));
        });
      case "time":
        return withLedger((ices) => {
          const untimed = ices.filter((i) => i.rosterId === myRosterId && i.status === "completed" && i.chugSeconds === undefined);
          const latest = untimed.sort((a, b) => b.week - a.week)[0];
          if (latest) return setTiming(latest);
          void alert({ kind: "info", title: "Add chug time", body: "Every chug you've paid already has a time. Upload a chug first, then time it." });
        });
    }
  };

  return (
    <>
      {!phone && (
        <button
          type="button"
          className="palette-fab"
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K"
          title="Search (Ctrl+K)"
          onClick={() => onOpenChange(true)}
        >
          <SearchIcon width={28} height={28} />
        </button>
      )}
      {open && <PaletteBox phone={phone} onPick={pick} onClose={() => onOpenChange(false)} />}
      {upload &&
        ledger.status === "ok" &&
        createPortal(<UploadChug ices={ledger.ledger.ices} initialIceIds={upload} onClose={() => setUpload(null)} />, document.body)}
      {timing && <ChugTimeDialog ice={timing} label={iceLabel(timing, teamFor, data?.players ?? {})} onClose={() => setTiming(null)} />}
    </>
  );
}
