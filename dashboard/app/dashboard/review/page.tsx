"use client";
import { useEffect, useState } from "react";

type Word = {
  id: string;
  raw_text: string;
  translation_en: string;
  pos: string;
  language: string;
  morph_data: { inflectionCategories?: string[] } | null;
  review_interval_days: number;
  ease_factor: number;
};

export default function ReviewPage() {
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/words?due_for_review=true")
      .then((r) => r.json())
      .then((data) => {
        setDueWords(data.words ?? []);
        setLoading(false);
      });
  }, []);

  const current = dueWords[currentIndex];
  const total = dueWords.length;

  const grade = async (gradeValue: 0 | 1 | 2 | 3) => {
    if (!current) return;

    const ef = current.ease_factor;
    const interval = current.review_interval_days;

    let newInterval: number;
    let newEf: number;

    if (gradeValue === 0) {
      newInterval = 1;
      newEf = Math.max(1.3, ef - 0.2);
    } else if (gradeValue === 1) {
      newInterval = Math.max(1, interval * 1.2);
      newEf = Math.max(1.3, ef - 0.15);
    } else if (gradeValue === 2) {
      newInterval = interval * ef;
      newEf = ef;
    } else {
      newInterval = interval * ef * 1.3;
      newEf = ef + 0.1;
    }

    const nextReviewAt = new Date(
      Date.now() + newInterval * 24 * 60 * 60 * 1000
    ).toISOString();

    await fetch("/api/words", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: current.id,
        nextReviewAt,
        reviewIntervalDays: newInterval,
        easeFactor: newEf,
      }),
    });

    setReviewed((r) => r + 1);
    setFlipped(false);
    setCurrentIndex((i) => i + 1);
  };

  if (loading) return <main className="p-8 text-slate-400">Loading...</main>;

  if (currentIndex >= total) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold">All done!</h1>
        <p className="text-slate-500">You reviewed {reviewed} word{reviewed !== 1 ? "s" : ""}.</p>
        <a href="/dashboard" className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700">
          Back to Dashboard
        </a>
      </main>
    );
  }

  const progressPct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;

  return (
    <main className="mx-auto max-w-lg space-y-6 p-8">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{currentIndex} / {total} reviewed</span>
        <a href="/dashboard" className="hover:underline">← Back</a>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-blue-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div
        onClick={() => setFlipped(true)}
        className="min-h-48 cursor-pointer rounded-2xl border bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-3 hover:shadow-md transition-shadow"
      >
        <div className="text-3xl font-bold text-slate-900">{current.raw_text}</div>
        <div className="text-xs font-mono text-slate-400">{current.language} · {current.pos}</div>
        {!flipped ? (
          <p className="text-sm text-slate-400 mt-4">Click to reveal</p>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="text-lg text-slate-700">{current.translation_en}</div>
            {current.morph_data?.inflectionCategories?.length ? (
              <div className="text-xs text-slate-400">
                {current.morph_data.inflectionCategories.join(", ")}
              </div>
            ) : null}
          </div>
        )}
      </div>
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Again", grade: 0 as const, color: "bg-red-500 hover:bg-red-600" },
            { label: "Hard", grade: 1 as const, color: "bg-orange-500 hover:bg-orange-600" },
            { label: "Good", grade: 2 as const, color: "bg-blue-500 hover:bg-blue-600" },
            { label: "Easy", grade: 3 as const, color: "bg-emerald-500 hover:bg-emerald-600" },
          ].map(({ label, grade: g, color }) => (
            <button
              key={label}
              onClick={() => grade(g)}
              className={`rounded-lg py-3 font-semibold text-white transition-colors ${color}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
