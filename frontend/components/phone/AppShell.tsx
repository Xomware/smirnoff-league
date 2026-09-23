"use client";

import { Desktop } from "@/components/desktop/Desktop";
import { Taskbar } from "@/components/xp/Taskbar";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";
import { PhoneShell } from "./PhoneShell";

export function AppShell() {
  const phone = useMediaQuery(PHONE);
  return (
    <NotificationsProvider>
      {phone ? (
        <PhoneShell />
      ) : (
        <>
          <Desktop />
          <Taskbar />
        </>
      )}
    </NotificationsProvider>
  );
}
