"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { getMe, type Me } from "@/lib/api/users";

export interface ProfileState {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  myRosterId: number | null;
  editing: boolean;
  setEditing: (editing: boolean) => void;
}

// Pages and the taskbar also render outside the provider (their own tests do),
// where there is simply no profile yet.
const ProfileContext = createContext<ProfileState>({
  me: null,
  loading: false,
  error: null,
  refresh: async () => {},
  myRosterId: null,
  editing: false,
  setEditing: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const result = await getMe().catch((e: Error) => e);
    if (result instanceof Error) return setError(result.message);
    setMe(result);
    setError(null);
  }, []);

  useEffect(() => {
    let live = true;
    getMe()
      .then((m) => live && setMe(m))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        me,
        loading: !me && !error,
        error,
        refresh,
        myRosterId: me?.profile?.rosterId ?? null,
        editing,
        setEditing,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
