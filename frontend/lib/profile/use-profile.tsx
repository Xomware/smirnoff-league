"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { getMe, type Me, updateMe } from "@/lib/api/users";

export interface ProfileState {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  myRosterId: number | null;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Optimistic: the mark moves at once and rolls back if the save fails. */
  markNotificationsSeen: (at: string) => Promise<void>;
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
  markNotificationsSeen: async () => {},
});

const withSeen = (seen: string | null) => (m: Me | null) =>
  m?.profile ? { ...m, profile: { ...m.profile, notificationsSeenAt: seen } } : m;

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

  const markNotificationsSeen = useCallback(
    async (at: string) => {
      const before = me?.profile?.notificationsSeenAt ?? null;
      setMe(withSeen(at));
      await updateMe({ notificationsSeenAt: at }).catch((e: Error) => {
        setMe(withSeen(before));
        throw e;
      });
    },
    [me],
  );

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
        markNotificationsSeen,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
