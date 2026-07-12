"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DigestView() {
  const [digest, setDigest] = useState<{
    title: string;
    summary: string;
    payload: string;
    weekStart: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/digest");
        const data = await res.json();
        setDigest(data.digest ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-muted text-sm">جارٍ التحميل…</p>;

  const payload = digest
    ? (JSON.parse(digest.payload) as {
        highlights?: Array<{
          id: string;
          text: string;
          figureName: string;
          figureSlug: string;
          sourceUrl: string;
        }>;
        openPromisesCount?: number;
        contradictions?: Array<{ explanation: string | null }>;
      })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">مساءلة الأسبوع</h1>
        <p className="text-sm text-muted mt-1">أبرز التصريحات والوعود ومرشّحات التناقض.</p>
      </div>
      {!digest ? (
        <p className="text-muted text-sm">
          لا نشرة بعد. من لوحة التحكم → المساءلة يمكن توليد الأسبوع الحالي.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-5 space-y-2">
            <h2 className="font-bold">{digest.title}</h2>
            <p className="leading-relaxed whitespace-pre-wrap">{digest.summary}</p>
            <p className="text-xs text-muted">
              وعود مفتوحة: {payload?.openPromisesCount ?? 0} · مرشّحات تناقض:{" "}
              {payload?.contradictions?.length ?? 0}
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold text-sm">أبرز التصريحات</h3>
            {(payload?.highlights ?? []).map((h) => (
              <div key={h.id} className="rounded-xl border border-border bg-card p-4 text-sm space-y-1">
                <Link href={`/f/${h.figureSlug}`} className="font-bold text-accent">
                  {h.figureName}
                </Link>
                <p>«{h.text}»</p>
                <a href={h.sourceUrl} className="text-accent text-xs" target="_blank" rel="noreferrer">
                  المصدر ↗
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
