"use client";

import { useContext, useState } from "react";

import { ViewParamsContext } from "@/components/views/drill-link";
import type { WindowParams } from "@/lib/desktop/windows";

export interface FilterOption {
  value: string;
  label: string;
}

// The first option is the default, which a link leaves out.
export interface FilterField {
  key: string;
  label: string;
  options: FilterOption[];
}

export type FilterValues = Record<string, string>;

// A view's filters ride in its link as dot-separated key-value pairs,
// `videos:week-3.team-6`, clear of the list's commas and a kind's colon.
export const FILTER_PARAM = /^[a-z]+-[a-z0-9]+(\.[a-z]+-[a-z0-9]+)*$/;

export const defaultFilters = (fields: FilterField[]): FilterValues => Object.fromEntries(fields.map((f) => [f.key, f.options[0].value]));

// A value the options don't hold, like a week with no videos yet, reads as the default.
export function readFilters(fields: FilterField[], param: string): FilterValues {
  const pairs = new Map(
    param.split(".").map((p) => {
      const [key, value] = p.split("-");
      return [key, value] as const;
    }),
  );
  return Object.fromEntries(
    fields.map(({ key, options }) => {
      const value = pairs.get(key);
      return [key, options.find((o) => o.value === value)?.value ?? options[0].value];
    }),
  );
}

export const writeFilters = (fields: FilterField[], values: FilterValues) =>
  fields
    .filter((f) => values[f.key] !== f.options[0].value)
    .map((f) => `${f.key}-${values[f.key]}`)
    .join(".");

// Inside a window or page the filters are the view's `filter` param, so they
// land in its link; outside one they are the view's own state.
export function useFilterParam(params: WindowParams): [string, (filter: string) => void] {
  const setParams = useContext(ViewParamsContext);
  const [own, setOwn] = useState("");
  if (!setParams) return [own, setOwn];
  return [String(params.filter ?? ""), (filter) => setParams({ filter })];
}

export const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
