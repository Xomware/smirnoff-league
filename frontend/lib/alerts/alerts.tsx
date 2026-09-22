"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Balloon } from "@/components/xp/Balloon";
import { type AlertKind, Dialog } from "@/components/xp/Dialog";
import type { AlertIconName } from "@/components/xp/icons";
import { play, type SoundName } from "@/lib/sound/sound";

export interface Notice {
  title: string;
  body: string;
  icon?: AlertIconName;
}

export interface AlertRequest {
  kind: AlertKind;
  title: string;
  body: string;
  buttons?: string[];
}

interface Alerts {
  notify: (notice: Notice) => void;
  // Resolves with the clicked button's label, or null when dismissed with Escape.
  alert: (request: AlertRequest) => Promise<string | null>;
}

type Queued<T> = T & { id: number };
type OpenDialog = Queued<AlertRequest> & { resolve: (button: string | null) => void };

const KIND_SOUND: Record<AlertKind, SoundName> = { info: "ding", warning: "chord", error: "error" };

// Outside the provider (signed out, or a page's own test) alerts go nowhere.
const AlertsContext = createContext<Alerts>({
  notify: () => {},
  alert: async () => null,
});

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [balloons, setBalloons] = useState<Queued<Notice>[]>([]);
  const [dialogs, setDialogs] = useState<OpenDialog[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((notice: Notice) => {
    const id = nextId.current++;
    setBalloons((q) => [...q, { ...notice, id }]);
    play("notify");
  }, []);

  const alert = useCallback(
    (request: AlertRequest) =>
      new Promise<string | null>((resolve) => {
        const id = nextId.current++;
        setDialogs((q) => [...q, { ...request, id, resolve }]);
        play(KIND_SOUND[request.kind]);
      }),
    [],
  );

  const dismissBalloon = useCallback(() => setBalloons((q) => q.slice(1)), []);
  const value = useMemo(() => ({ notify, alert }), [notify, alert]);
  const balloon = balloons[0];
  const dialog = dialogs[0];

  return (
    <AlertsContext.Provider value={value}>
      {children}
      {balloon && (
        <Balloon
          key={balloon.id}
          title={balloon.title}
          body={balloon.body}
          icon={balloon.icon ?? "ice"}
          onClose={dismissBalloon}
        />
      )}
      {dialog && (
        <Dialog
          key={dialog.id}
          kind={dialog.kind}
          title={dialog.title}
          body={dialog.body}
          buttons={dialog.buttons ?? ["OK"]}
          onClose={(button) => {
            dialog.resolve(button);
            setDialogs((q) => q.slice(1));
          }}
        />
      )}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertsContext);
