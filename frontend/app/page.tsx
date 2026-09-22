import { SignOutButton } from "@/components/auth/sign-out-button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Smirnoff League</h1>
      <p className="text-neutral-500">Coming soon.</p>
      <SignOutButton />
    </main>
  );
}
