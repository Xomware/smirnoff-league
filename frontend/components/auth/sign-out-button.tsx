"use client";

import { useAuth } from "@/lib/auth/use-auth";

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="min-h-11 border border-stone-500 bg-stone-50 px-6 py-2 font-semibold hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:bg-stone-300"
    >
      Sign out
    </button>
  );
}
