"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function QuizGame() {
  const [quote, setQuote] = useState("");
  const [options, setOptions] = useState<
    Array<{ figureId: string; name: string; title: string | null; slug: string }>
  >([]);
  const [date, setDate] = useState("");
  const [result, setResult] = useState<{
    correct: boolean;
    correctName?: string;
    figureSlug?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/quiz");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "فشل");
        setQuote(data.quote);
        setOptions(Array.isArray(data.options) ? data.options : []);
        setDate(data.date ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطأ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function choose(figureId: string) {
    if (result) return;
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figureId }),
    });
    const data = await res.json();
    setResult({
      correct: Boolean(data.correct),
      correctName: data.correctName,
      figureSlug: data.figureSlug,
    });
  }

  if (loading) return <p className="text-muted text-sm">جارٍ التحميل…</p>;
  if (error) return <p className="text-breaking text-sm">{error}</p>;

  return (
    <div className="space-y-5 max-w-xl mx-auto text-center">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">من قال هذا؟</h1>
        <p className="text-xs text-muted mt-1">تحدّي يومي · {date}</p>
      </div>
      <blockquote className="rounded-xl border border-border bg-card p-5 text-base sm:text-lg font-semibold leading-relaxed text-right">
        «{quote}»
      </blockquote>
      <div className="grid gap-2">
        {options.map((o) => (
          <button
            key={o.figureId}
            type="button"
            disabled={Boolean(result)}
            onClick={() => void choose(o.figureId)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:border-accent disabled:opacity-70"
          >
            {o.name}
            {o.title ? <span className="block text-xs font-normal text-muted mt-0.5">{o.title}</span> : null}
          </button>
        ))}
      </div>
      {result && (
        <div
          className={`rounded-xl p-4 text-sm ${
            result.correct ? "bg-accent-soft text-accent" : "bg-breaking/10 text-breaking"
          }`}
        >
          {result.correct ? "صحيح!" : `خطأ — القائل: ${result.correctName}`}
          {result.figureSlug && (
            <div className="mt-2">
              <Link href={`/f/${result.figureSlug}`} className="underline font-semibold">
                صفحة الشخصية
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
