import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("root layout metadata", () => {
  it("tells search engines not to index the site", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
