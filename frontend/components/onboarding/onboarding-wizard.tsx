"use client";

import { useId, useState, type FormEvent } from "react";

import { IceBottleIcon, WarningIcon } from "@/components/xp/icons";
import { TeamName } from "@/components/xp/TeamName";
import { Window } from "@/components/xp/Window";
import { ApiError, updateMe, type Profile } from "@/lib/api/users";
import { useLeague } from "@/lib/league/use-league";

import "./onboarding.css";

type Field = "name" | "username" | "rosterId";

const STEPS: { field: Field; title: string }[] = [
  { field: "name", title: "Your name" },
  { field: "username", title: "Pick a username" },
  { field: "rosterId", title: "Pick your team" },
];

// Mirrors the users_update handler, so most mistakes never reach the server.
function nameError(name: string) {
  const n = name.trim().length;
  if (n === 0) return "Enter your name.";
  return n > 40 ? "Keep it to 40 characters." : null;
}

function usernameError(username: string) {
  if (!/^[A-Za-z0-9_.-]*$/.test(username)) return "Use only letters, numbers, _ . and -.";
  return username.length < 2 || username.length > 20 ? "Use 2 to 20 characters." : null;
}

interface OnboardingWizardProps {
  initial?: Profile | null;
  onDone: () => void | Promise<void>;
  onCancel?: () => void;
}

export function OnboardingWizard({ initial, onDone, onCancel }: OnboardingWizardProps) {
  const id = useId();
  const { data, error: leagueError, teamFor } = useLeague();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [rosterId, setRosterId] = useState<number | null>(initial?.rosterId ?? null);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clientErrors: Record<Field, string | null> = {
    name: nameError(name),
    username: usernameError(username),
    rosterId: rosterId === null ? "Pick your team." : null,
  };
  const errorFor = (f: Field) => serverErrors[f] ?? (touched[f] ? clientErrors[f] : null);
  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const edit = (f: Field) => setServerErrors((e) => ({ ...e, [f]: undefined }));

  const last = step === STEPS.length - 1;

  async function save(roster: number) {
    setSaving(true);
    setFailure(null);
    const err = await updateMe({ name: name.trim(), username, rosterId: roster }).then(
      () => null,
      (e: Error) => e,
    );
    setSaving(false);
    if (!err) return onDone();

    const field = err instanceof ApiError && err.status === 400 ? err.detail?.field : undefined;
    const back = STEPS.findIndex((s) => s.field === field);
    if (back === -1) return setFailure(err.message);
    setServerErrors({ [STEPS[back].field]: err.message });
    setStep(back);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const field = STEPS[step].field;
    if (serverErrors[field] || clientErrors[field]) return touch(field);
    if (!last) return setStep(step + 1);
    if (rosterId !== null) void save(rosterId);
  }

  const textField = (field: "name" | "username", label: string, value: string, hint: string) => {
    const error = errorFor(field);
    const inputId = `${id}-${field}`;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="font-bold">
          {label}
        </label>
        <input
          id={inputId}
          className="xp-input"
          value={value}
          maxLength={field === "name" ? 40 : 20}
          autoComplete={field === "name" ? "name" : "username"}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
          onChange={(e) => {
            edit(field);
            (field === "name" ? setName : setUsername)(e.target.value);
          }}
          onBlur={() => touch(field)}
        />
        <p id={`${inputId}-hint`}>{hint}</p>
        {error && (
          <p id={`${inputId}-error`} className="xp-note flex items-center gap-1">
            <WarningIcon className="shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  };

  const headingId = `${id}-heading`;
  const rosterError = errorFor("rosterId");

  return (
    <main className="xp-page min-h-dvh justify-center">
      <Window title={initial ? "My Profile" : "Smirnoff League Setup"} icon={<IceBottleIcon />} className="xp-wizard">
        <form onSubmit={onSubmit} noValidate className="xp-wizard-body">
          <aside className="xp-wizard-banner">
            <IceBottleIcon width={40} height={40} />
            <p className="xp-wizard-banner-title">Welcome to the Smirnoff League</p>
            <ol className="xp-wizard-steps">
              {STEPS.map((s, i) => (
                <li key={s.field} aria-current={i === step ? "step" : undefined}>
                  {s.title}
                </li>
              ))}
            </ol>
          </aside>

          <div className="xp-wizard-page">
            <p className="text-xs">
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 id={headingId} className="xp-wizard-heading">
              {STEPS[step].title}
            </h3>

            {step === 0 && textField("name", "Full name", name, "How the league sees you on the site.")}
            {step === 1 &&
              textField("username", "Username", username, "2-20 characters: letters, numbers, _ . or -")}
            {step === 2 && (
              <fieldset aria-labelledby={headingId} aria-describedby={`${id}-teams-hint`}>
                <p id={`${id}-teams-hint`} className="mb-2">
                  Co-owners pick the same team.
                </p>
                {leagueError ? (
                  <p role="alert">Could not reach Sleeper ({leagueError}). Refresh to try again.</p>
                ) : !data ? (
                  <p role="status">Loading the teams...</p>
                ) : (
                  <ul className="xp-wizard-teams">
                    {[...data.rosters]
                      .sort((a, b) => a.roster_id - b.roster_id)
                      .map((r) => {
                        const team = teamFor(r.roster_id);
                        const { wins, losses, ties } = team.record;
                        return (
                          <li key={r.roster_id}>
                            <label className="xp-wizard-team">
                              <input
                                type="radio"
                                name={`${id}-team`}
                                value={r.roster_id}
                                checked={rosterId === r.roster_id}
                                onChange={() => {
                                  edit("rosterId");
                                  setRosterId(r.roster_id);
                                }}
                              />
                              <TeamName name={team.name} avatarUrl={team.avatarUrl} iced={false} ices={0} />
                              <span className="ml-auto tabular-nums">
                                <span className="sr-only">, record </span>
                                {wins}-{losses}
                                {ties > 0 && `-${ties}`}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                )}
                {rosterError && (
                  <p className="xp-note mt-2 flex items-center gap-1">
                    <WarningIcon className="shrink-0" />
                    {rosterError}
                  </p>
                )}
              </fieldset>
            )}

            {failure && (
              <p role="alert" className="xp-note mt-3">
                Could not save your profile ({failure}). Try again.
              </p>
            )}
          </div>

          <div className="xp-wizard-actions">
            {onCancel && (
              <button type="button" className="xp-button mr-auto" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="xp-button"
              disabled={step === 0 || saving}
              onClick={() => setStep(step - 1)}
            >
              <span aria-hidden>&lt;</span> Back
            </button>
            <button type="submit" className="xp-button" disabled={saving}>
              {!last ? (
                <>
                  Next <span aria-hidden>&gt;</span>
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                "Finish"
              )}
            </button>
          </div>
        </form>
      </Window>
    </main>
  );
}
