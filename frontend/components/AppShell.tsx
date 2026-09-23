"use client";

import { useState } from "react";

import { Desktop } from "@/components/desktop/Desktop";
import { MobileShell } from "@/components/mobile/MobileShell";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { Taskbar } from "@/components/xp/Taskbar";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";

// The desktop has no game window, so a game opens its week's scores.
function DesktopSearch() {
  const { open } = useDesktop();
  const [searching, setSearching] = useState(false);
  return (
    <CommandPalette
      phone={false}
      open={searching}
      onOpenChange={setSearching}
      onGo={(to) => (to.type === "game" ? open("week", { week: to.week }) : open(to.kind, to.params))}
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
        </>
      )}
    </NotificationsProvider>
  );
}
