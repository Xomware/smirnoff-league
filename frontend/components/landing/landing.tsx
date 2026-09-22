interface LandingProps {
  // Absent when this build has no Cognito config, which leaves the button disabled.
  onSignIn?: () => void;
}

export function Landing({ onSignIn }: LandingProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-100 p-8 text-center text-stone-900">
      <h1 className="text-3xl font-bold">Smirnoff League</h1>
      <button
        type="button"
        onClick={onSignIn}
        disabled={!onSignIn}
        className="min-h-11 border border-stone-500 bg-stone-50 px-6 py-2 font-semibold hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:bg-stone-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Sign in with Google
      </button>
    </main>
  );
}
