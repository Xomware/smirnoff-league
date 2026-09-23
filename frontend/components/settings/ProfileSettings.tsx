"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";

import { nameError, usernameError } from "@/components/onboarding/onboarding-wizard";
import { ApiError, type Profile, updateMe } from "@/lib/api/users";
import { useLeague } from "@/lib/league/use-league";
import { useProfile } from "@/lib/profile/use-profile";

import "./settings.css";

type Field = "name" | "username" | "rosterId";
const FIELDS: Field[] = ["name", "username", "rosterId"];
const isField = (f: unknown): f is Field => FIELDS.includes(f as Field);

interface ProfileFormProps {
  profile: Profile;
  onSaved: () => Promise<void>;
}

// The wizard's fields on one page, so an edit is a single Save rather than four steps.
function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const id = useId();
  const { data, teamFor } = useLeague();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [rosterId, setRosterId] = useState(profile.rosterId);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = { name: nameError(name) ?? undefined, username: usernameError(username) ?? undefined };
    setErrors(found);
    setFailure(null);
    if (found.name || found.username) return;
    setState("saving");
    const err = await updateMe({ name: name.trim(), username, rosterId }).then(
      () => null,
      (e: Error) => e,
    );
    if (!err) {
      await onSaved();
      return setState("saved");
    }
    setState("idle");
    const field = err instanceof ApiError && err.status === 400 ? err.detail?.field : undefined;
    if (isField(field)) setErrors({ [field]: err.message });
    else setFailure(err.message);
  }

  const field = (f: Field, label: string, control: (describedBy: string | undefined) => ReactNode) => (
    <div className="settings-field">
      <label htmlFor={`${id}-${f}`}>{label}</label>
      {control(errors[f] ? `${id}-${f}-error` : undefined)}
      {errors[f] && (
        <p id={`${id}-${f}-error`} className="xp-note">
          {errors[f]}
        </p>
      )}
    </div>
  );

  return (
    <form className="settings settings-form" noValidate onSubmit={onSubmit} onChange={() => setState("idle")}>
      {field("name", "Full name", (describedBy) => (
        <input
          id={`${id}-name`}
          className="xp-input"
          value={name}
          maxLength={40}
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy}
          onChange={(e) => setName(e.target.value)}
        />
      ))}
      {field("username", "Username", (describedBy) => (
        <input
          id={`${id}-username`}
          className="xp-input"
          value={username}
          maxLength={20}
          autoComplete="username"
          aria-invalid={Boolean(errors.username)}
          aria-describedby={describedBy}
          onChange={(e) => setUsername(e.target.value)}
        />
      ))}
      {field("rosterId", "Your team", (describedBy) => (
        <select
          id={`${id}-rosterId`}
          className="xp-select"
          value={rosterId}
          disabled={!data}
          aria-describedby={describedBy}
          onChange={(e) => setRosterId(Number(e.target.value))}
        >
          {data ? (
            [...data.rosters]
              .sort((a, b) => a.roster_id - b.roster_id)
              .map((r) => (
                <option key={r.roster_id} value={r.roster_id}>
                  {teamFor(r.roster_id).name}
                </option>
              ))
          ) : (
            <option value={rosterId}>Loading the teams...</option>
          )}
        </select>
      ))}
      <p className="settings-hint">Co-owners pick the same team.</p>
      {failure && (
        <p role="alert" className="xp-note">
          Could not save your profile ({failure}). Try again.
        </p>
      )}
      <div className="settings-actions">
        <button type="submit" className="xp-button" disabled={state === "saving"}>
          {state === "saving" ? "Saving..." : "Save profile"}
        </button>
        <span role="status">{state === "saved" && "Saved."}</span>
      </div>
    </form>
  );
}

export function ProfileSettings() {
  const { me, error, refresh } = useProfile();
  if (error) return <p role="alert">Could not load your account ({error}).</p>;
  if (!me?.profile) return <p role="status">Loading your profile...</p>;
  return <ProfileForm profile={me.profile} onSaved={refresh} />;
}
