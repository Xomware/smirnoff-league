import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "verify-build.mjs");

const COGNITO = {
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: "us-east-1_abc123",
  NEXT_PUBLIC_COGNITO_CLIENT_ID: "client123",
  NEXT_PUBLIC_COGNITO_DOMAIN: "smirnoff.auth.us-east-1.amazoncognito.com",
};

function buildWith(bundle: string): string {
  const dir = mkdtempSync(join(tmpdir(), "verify-build-"));
  mkdirSync(join(dir, "out", "_next"), { recursive: true });
  writeFileSync(join(dir, "out", "_next", "app.js"), bundle);
  return dir;
}

function verify(cwd: string, env: Record<string, string>) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith("NEXT_PUBLIC_COGNITO_") && k !== "REQUIRE_AUTH_ENV",
    ),
  );
  return spawnSync(process.execPath, [SCRIPT], {
    cwd,
    env: { ...clean, ...env } as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
}

describe("verify-build", () => {
  it("fails when REQUIRE_AUTH_ENV=1 and the Cognito env is missing", () => {
    const res = verify(buildWith("console.log('no auth')"), { REQUIRE_AUTH_ENV: "1" });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/NEXT_PUBLIC_COGNITO_USER_POOL_ID/);
  });

  it("fails when the env is set but never reached the bundle", () => {
    const res = verify(buildWith("console.log('no auth')"), { REQUIRE_AUTH_ENV: "1", ...COGNITO });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/not in the bundle/);
  });

  it("passes when every Cognito value is in the bundle", () => {
    const res = verify(buildWith(JSON.stringify(COGNITO)), { REQUIRE_AUTH_ENV: "1", ...COGNITO });
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  });

  it("skips the check when REQUIRE_AUTH_ENV is unset", () => {
    const res = verify(buildWith("console.log('no auth')"), {});
    expect(res.status).toBe(0);
  });
});
