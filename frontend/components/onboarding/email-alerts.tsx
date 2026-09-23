"use client";

import { useState } from "react";

import { EMAIL_TYPES, updateMe, type EmailPrefs, type EmailType } from "@/lib/api/users";

export const DEFAULT_EMAIL: EmailPrefs = {
  optIn: false,
  types: { iced: true, due48h: true, due6h: true, lateAdded: true, edition: true, videoOfMine: true },
};

interface EmailAlertsProps {
  /** From the ID token, never typed in. */
  address: string;
  initial: EmailPrefs;
}

// Each toggle saves on its own, like a settings panel, so Cancel on the wizard
// does not undo it. The inputs lock while a save is in flight so two saves of
// the whole object cannot land out of order.
export function EmailAlerts({ address, initial }: EmailAlertsProps) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function save(next: EmailPrefs) {
    const before = prefs;
    setPrefs(next);
    setSaving(true);
    setFailure(null);
    await updateMe({ email: next }).catch((e: Error) => {
      setPrefs(before);
      setFailure(e.message);
    });
    setSaving(false);
  }

  return (
    <div className="xp-email-alerts">
      <label className="xp-email-optin">
        <input
          type="checkbox"
          checked={prefs.optIn}
          disabled={saving}
          onChange={(e) => void save({ ...prefs, optIn: e.target.checked })}
        />
        <span>
          Email me alerts at <strong>{address}</strong>
        </span>
      </label>
      <fieldset className="xp-email-types">
        <legend>Send an email</legend>
        {(Object.keys(EMAIL_TYPES) as EmailType[]).map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={prefs.types[type]}
              disabled={!prefs.optIn || saving}
              onChange={(e) => void save({ ...prefs, types: { ...prefs.types, [type]: e.target.checked } })}
            />
            {EMAIL_TYPES[type]}
          </label>
        ))}
      </fieldset>
      <p className="text-xs">Changes save as you click.</p>
      {failure && (
        <p role="alert" className="xp-note">
          Could not save your email alerts ({failure}). Try again.
        </p>
      )}
    </div>
  );
}
