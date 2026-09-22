#!/usr/bin/env node
// Postbuild check that the Cognito config reached the bundle. Without it the
// build still succeeds, but authConfigured is false and nobody can sign in,
// and nothing fails until someone tries.
//
// Opt-in via REQUIRE_AUTH_ENV=1, which only the deploy workflow sets. PR CI
// and local builds have no Cognito env and must still pass.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REQUIRED = [
  "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
  "NEXT_PUBLIC_COGNITO_CLIENT_ID",
  "NEXT_PUBLIC_COGNITO_DOMAIN",
];

if (process.env.REQUIRE_AUTH_ENV !== "1") process.exit(0);

const bundle = readdirSync("out", { recursive: true })
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(join("out", f), "utf8"))
  .join("\n");

const failures = REQUIRED.flatMap((name) => {
  const value = process.env[name];
  if (!value) return [`${name} is not set`];
  if (!bundle.includes(value)) return [`${name} is set but its value is not in the bundle`];
  return [];
});

if (failures.length > 0) {
  console.error(`verify-build: Cognito config missing, sign-in would be dead:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
