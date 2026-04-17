"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Read With Porpoise 🐬</h1>
          <p className="text-sm text-slate-500">
            Sign in to save words and review with flashcards.
          </p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
