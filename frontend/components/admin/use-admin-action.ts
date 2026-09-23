"use client";

import { useCallback } from "react";

import { useAlerts } from "@/lib/alerts/alerts";
import { refreshLedger } from "@/lib/ices/use-ledger";

// Every admin write ends in a ledger refetch: on success it confirms the
// optimistic row, on failure it puts the real one back.
export function useAdminAction() {
  const { alert } = useAlerts();

  const run = useCallback(
    async (call: () => Promise<unknown>): Promise<boolean> => {
      const failed = await call().then(
        () => null,
        (e: Error) => e,
      );
      if (failed) void alert({ kind: "error", title: "Control Panel", body: failed.message });
      refreshLedger();
      return !failed;
    },
    [alert],
  );

  const confirm = useCallback(
    async (title: string, body: string, action: string, cancel = "Cancel") =>
      (await alert({ kind: "warning", title, body, buttons: [action, cancel] })) === action,
    [alert],
  );

  return { run, confirm };
}
