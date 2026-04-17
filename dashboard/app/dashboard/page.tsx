import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("id", user.id)
    .single();

  const xpToNextLevel = 100 - (stats?.xp ?? 0) % 100;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <h1 className="text-3xl font-bold">The Reef 🪸</h1>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Level" value={stats?.level ?? 1} />
        <StatCard label="XP" value={`${stats?.xp ?? 0} (${xpToNextLevel} to next)`} />
        <StatCard label="Streak" value={`${stats?.streak_count ?? 0} days 🔥`} />
        <StatCard label="Words Saved" value={stats?.total_words_saved ?? 0} />
      </div>
      <div className="flex gap-3">
        <a
          href="/dashboard/words"
          className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"
        >
          My Words
        </a>
        <a
          href="/dashboard/review"
          className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
        >
          Review Now
        </a>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
