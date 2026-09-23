"use client";

import { Desktop } from "@/components/desktop/Desktop";
import { MobileShell } from "@/components/mobile/MobileShell";
import { Taskbar } from "@/components/xp/Taskbar";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";

export function AppShell() {
  const phone = useMediaQuery(PHONE);
  return (
    <NotificationsProvider>
      {phone ? (
        <MobileShell />
      ) : (
        <>
          <Desktop />
          <Taskbar />
        </>
      )}
    </NotificationsProvider>
  );
}
