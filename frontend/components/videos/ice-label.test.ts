import { describe, expect, it } from "vitest";

import type { LedgerIce } from "@/lib/api/ledger";
import { iceCauseText } from "./ice-label";

const late = (parentIceId: string, n: number): LedgerIce =>
  ({ iceId: `${parentIceId}#LATE${n}`, parentIceId, week: 2, rosterId: 13, reason: "late", status: "owed" }) as LedgerIce;

describe("iceCauseText", () => {
  it("tells apart the late ices of one team by the ice they came from", () => {
    const labels = [late("W02#R13#S3", 1), late("W02#R13#LOWEST", 1)].map((i) => iceCauseText(i, {}));
    expect(labels).toEqual(["Late ice 1 · WR slot", "Late ice 1 · lowest score"]);
  });
});
