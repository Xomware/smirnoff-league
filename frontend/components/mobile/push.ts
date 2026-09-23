"use client";

import { createContext, useContext } from "react";

import type { Screen } from "@/lib/phone/nav";

// Phone screens push the phone's own kinds (a game, the team list) here;
// DrillLinks reach the same stack through DrillContext.
export const PushContext = createContext<(screen: Screen) => void>(() => {});

export const usePush = () => useContext(PushContext);
