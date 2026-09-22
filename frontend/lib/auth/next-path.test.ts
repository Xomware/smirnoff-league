// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { rememberNextPath, takeNextPath } from "./next-path";

beforeEach(() => window.sessionStorage.clear());

describe("next-path", () => {
  it("round-trips a same-origin path once", () => {
    rememberNextPath("/standings/");
    expect(takeNextPath()).toBe("/standings/");
    expect(takeNextPath()).toBe("/");
  });

  it.each(["https://evil.example/", "//evil.example/", "/\\evil.example"])(
    "rejects %s",
    (target) => {
      rememberNextPath(target);
      expect(takeNextPath()).toBe("/");
    },
  );
});
