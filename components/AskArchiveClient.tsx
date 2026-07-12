"use client";

import Link from "next/link";
import { useState } from "react";

export default function AskArchiveClient() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const [citations, setCitations] = useState<
    Array<{
      id: string;
      text: string;
      figureName: string;
      figureSlug: string;
      statementDate: string;
      sourceUrl: string;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل");
      setAnswer(data.answer);
      setInsufficient(Boolean(data.insufficientEvidence));
      setCitations(Array.isArray(data.citations) ? data.citations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">اسأل الأرشيف</h1>
        <p className="text-sm text-muted mt-1">
          إجابات مقيّدة بالتصريحات المعتمدة فقط. إن لم يوجد دليل: نقوله صراحة.
        </p>
      </div>
      <form onSubmit={ask} className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="مثال: من تحدّث عن الميزانية أو الإنفاق الحكومي؟"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="rounded-xl bg-accent text-accent-contrast font-bold px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {busy ? "يراجع الأرشيف…" : "اسأل"}
        </button>
      </form>
      {error && <p className="text-sm text-breaking">{error}</p>}
      {answer && (
        <div
          className={`rounded-xl border p-4 ${
            insufficient ? "border-gold/40 bg-gold/5" : "border-accent/40 bg-accent-soft/20"
          }`}
        >
          <p className="leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}
      {citations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-sm">المصادر</h2>
          {citations.map((c) => (
            <blockquote
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 text-sm space-y-2"
            >
              <div className="font-semibold">
                <Link href={`/f/${c.figureSlug}`} className="text-accent hover:underline">
                  {c.figureName}
                </Link>
              </div>
              <p>«{c.text}»</p>
              <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-accent text-xs">
                المصدر ↗
              </a>
              <div>
                <Link
                  href={`/contradictions/${c.id}`}
                  className="text-xs text-muted hover:text-accent"
                >
                  تتبّع التناقض ←
                </Link>
              </div>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
