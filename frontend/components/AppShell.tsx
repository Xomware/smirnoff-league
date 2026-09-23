"use client";

import { useState } from "react";

import { Desktop } from "@/components/desktop/Desktop";
import { XpCursor } from "@/components/desktop/XpCursor";
import { MobileShell } from "@/components/mobile/MobileShell";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { Taskbar } from "@/components/xp/Taskbar";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";

function DesktopSearch() {
  const { open } = useDesktop();
  const [searching, setSearching] = useState(false);
  return (
    <CommandPalette
      phone={false}
      open={searching}
      onOpenChange={setSearching}
      onGo={(to) => open(to.kind, to.params)}
    />
  );
}

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
          <DesktopSearch />
          <XpCursor />
        </>
      )}
    </NotificationsProvider>
  );
}
