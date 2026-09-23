"use client";

import { useState } from "react";

import { Desktop } from "@/components/desktop/Desktop";
import { XpCursor } from "@/components/desktop/XpCursor";
import { GlacierShell } from "@/components/glacier/GlacierShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { Taskbar } from "@/components/xp/Taskbar";
import { useDesktop } from "@/lib/desktop/desktop-context";
import { TroubleProvider } from "@/lib/ices/use-trouble";
import { NotificationsProvider } from "@/lib/notifications/use-notifications";
import { useTheme } from "@/lib/theme/theme";
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
  const { theme } = useTheme();
  return (
    <NotificationsProvider>
      <TroubleProvider on={theme === "glacier"}>
        {phone ? (
          <MobileShell theme={theme} />
        ) : theme === "glacier" ? (
          <GlacierShell />
        ) : (
          <>
            <Desktop />
            <Taskbar />
            <DesktopSearch />
            <XpCursor />
          </>
        )}
      </TroubleProvider>
    </NotificationsProvider>
  );
}
