"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PromiseRow {
  id: string;
  text: string;
  statementDate: string;
  sourceUrl: string;
  figureName: string;
  figureSlug: string;
  figureTitle: string | null;
  topicName: string | null;
  daysOpen: number;
  promiseStatus: string | null;
}

export default function PromisesRadar() {
  const [items, setItems] = useState<PromiseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/promises");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">رادار الوعود</h1>
        <p className="text-sm text-muted mt-1">
          تصريحات مُصنَّفة كتعهّدات مفتوحة — مع عدّاد الأيام منذ التصريح.
        </p>
      </div>
      {error && <p className="text-breaking text-sm">{error}</p>}
      {loading ? (
        <p className="text-muted text-sm">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="text-muted text-sm">
          لا وعود مفتوحة بعد. تُصنَّف تلقائياً عند اعتماد التصريح — أو شغّل{" "}
          <code className="text-xs">npm run classify:statements</code>.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/f/${p.figureSlug}`} className="font-bold text-accent">
                  {p.figureName}
                </Link>
                <span className="rounded-full bg-gold/15 text-gold border border-gold/30 px-2 py-0.5 text-xs font-semibold tabular">
                  مفتوح منذ {p.daysOpen} يوماً
                </span>
              </div>
              <blockquote className="leading-relaxed">«{p.text}»</blockquote>
              <div className="text-xs text-muted flex flex-wrap gap-3">
                {p.topicName && <span>{p.topicName}</span>}
                <a href={p.sourceUrl} className="text-accent" target="_blank" rel="noreferrer">
                  المصدر ↗
                </a>
                <Link href={`/contradictions/${p.id}`} className="hover:text-accent">
                  تناقض؟
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
