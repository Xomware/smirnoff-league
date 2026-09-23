"use client";

import { Desktop } from "@/components/desktop/Desktop";
import { Taskbar } from "@/components/xp/Taskbar";
import { PHONE, useMediaQuery } from "@/lib/use-media-query";
import { PhoneShell } from "./PhoneShell";

export function AppShell() {
  if (useMediaQuery(PHONE)) return <PhoneShell />;
  return (
    <>
      <Desktop />
      <Taskbar />
    </>
  );
}
