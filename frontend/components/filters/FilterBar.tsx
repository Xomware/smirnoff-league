"use client";

import { type FormEvent, type MouseEvent, type ReactNode, useId, useState } from "react";

import { MenuDrawer } from "@/components/glacier/MenuDrawer";
import { CloseGlyph, FunnelIcon } from "@/components/xp/icons";
import { defaultFilters, type FilterField, type FilterValues } from "@/lib/filters/filters";
import { useMediaQuery } from "@/lib/use-media-query";

import "./filters.css";

// Narrower than the phone shell's breakpoint: a phone held upright.
const NARROW = "(max-width: 639.98px)";

interface SelectsProps {
  fields: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

function Selects({ fields, values, onChange }: SelectsProps) {
  return fields.map((f) => (
    <label key={f.key} className="filters-field">
      {f.label}
      <select className="xp-select" value={values[f.key]} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  ));
}

interface FilterBarProps {
  fields: FilterField[];
  values: FilterValues;
  // The live result count, like "12 videos".
  count: string;
  onChange: (values: FilterValues) => void;
  // The page's own toolbar actions, after the count.
  children?: ReactNode;
}

export function FilterBar({ fields, values, count, onChange, children }: FilterBarProps) {
  const narrow = useMediaQuery(NARROW);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const titleId = useId();
  const sheetId = useId();
  const active = fields.filter((f) => values[f.key] !== f.options[0].value);

  const status = (
    <p role="status" className="filters-count">
      {count}
    </p>
  );
  const chips = active.length > 0 && (
    <div role="group" aria-label="Active filters" className="filters-chips">
      {active.map((f) => {
        const text = `${f.label}: ${f.options.find((o) => o.value === values[f.key])?.label}`;
        return (
          <button key={f.key} type="button" className="filters-chip" aria-label={`Remove ${text}`} onClick={() => onChange({ ...values, [f.key]: f.options[0].value })}>
            {text}
            <CloseGlyph width={10} height={10} />
          </button>
        );
      })}
      <button type="button" className="filters-clear" onClick={() => onChange(defaultFilters(fields))}>
        Clear all
      </button>
    </div>
  );

  if (!narrow) {
    return (
      <div role="group" aria-labelledby={titleId} className="xp-group filters">
        <h3 id={titleId} className="xp-group-title">
          Filters
        </h3>
        <div className="filters-row">
          <Selects fields={fields} values={values} onChange={onChange} />
          {status}
          {children}
        </div>
        {chips}
      </div>
    );
  }

  // Safari never focuses a tapped button, and the sheet hands focus back to whatever had it.
  const show = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus();
    setDraft(values);
    setOpen(true);
  };
  const apply = (e: FormEvent) => {
    e.preventDefault();
    onChange(draft);
    setOpen(false);
  };

  return (
    <div role="group" aria-label="Filters" className="filters filters-narrow">
      <div className="filters-row">
        <button type="button" className="xp-button filters-open" aria-haspopup="dialog" aria-expanded={open} aria-controls={sheetId} onClick={show}>
          <FunnelIcon />
          Filters
          {active.length > 0 && (
            <>
              <span className="filters-badge" aria-hidden>
                {active.length}
              </span>
              <span className="sr-only">, {active.length} active</span>
            </>
          )}
        </button>
        {status}
        {children}
      </div>
      {chips}
      <MenuDrawer id={sheetId} title="Filters" side="bottom" open={open} onClose={() => setOpen(false)}>
        <form className="filters-sheet" onSubmit={apply}>
          <Selects fields={fields} values={draft} onChange={setDraft} />
          <div className="filters-actions">
            <button type="button" className="xp-button" onClick={() => setDraft(defaultFilters(fields))}>
              Reset
            </button>
            <button type="submit" className="xp-button">
              Apply
            </button>
          </div>
        </form>
      </MenuDrawer>
    </div>
  );
}

interface FilterEmptyProps {
  children: ReactNode;
  onClear: () => void;
}

export function FilterEmpty({ children, onClear }: FilterEmptyProps) {
  return (
    <div className="filters-empty">
      <p>{children}</p>
      <button type="button" className="xp-button" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
