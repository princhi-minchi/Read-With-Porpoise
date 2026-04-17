"use client";
import { useEffect, useState } from "react";

type Word = {
  id: string;
  raw_text: string;
  lemma: string;
  language: string;
  pos: string;
  translation_en: string;
  created_at: string;
};

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [language, setLanguage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchWords = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (language) params.set("language", language);
    const res = await fetch(`/api/words?${params}`);
    const data = await res.json();
    setWords(data.words ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchWords(); }, [language]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/words?id=${id}`, { method: "DELETE" });
    setWords((w) => w.filter((word) => word.id !== id));
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Words</h1>
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">← Back</a>
      </div>
      <div className="flex gap-2">
        {["", "IT"].map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`rounded-full px-4 py-1 text-sm font-medium border transition-colors ${
              language === lang
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
            }`}
          >
            {lang || "All"}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : words.length === 0 ? (
        <p className="text-slate-400">No words saved yet. Use the extension to save words.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Word</th>
                <th className="px-4 py-3">Lemma</th>
                <th className="px-4 py-3">POS</th>
                <th className="px-4 py-3">Lang</th>
                <th className="px-4 py-3">Translation</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {words.map((word) => (
                <tr key={word.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{word.raw_text}</td>
                  <td className="px-4 py-3 text-slate-500">{word.lemma}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono">
                      {word.pos}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{word.language}</td>
                  <td className="px-4 py-3 text-slate-500">{word.translation_en}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(word.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
