import { describe, expect, it } from "vitest";
import { metadata, viewport } from "./layout";

describe("root layout metadata", () => {
  it("tells search engines not to index the site", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("draws under the iPhone notch and home bar, which the CSS pads with the safe-area insets", () => {
    expect(viewport).toMatchObject({ width: "device-width", initialScale: 1, viewportFit: "cover" });
  });
});
