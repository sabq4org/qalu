"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Candidate {
  id: string;
  text: string;
  statementDate: string;
  sourceUrl: string;
  topicName: string | null;
  similarity: number;
  explanation: string;
  isContradiction: boolean;
}

export default function ContradictionsClient({ statementId }: { statementId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{
    text: string;
    figureName: string;
    figureSlug: string;
  } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/statements/${statementId}/contradictions`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "فشل");
        setAnchor(data.anchor);
        setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطأ");
      } finally {
        setLoading(false);
      }
    })();
  }, [statementId]);

  if (loading) return <p className="text-muted text-sm">يحلّل الأرشيف بحثاً عن تناقض…</p>;
  if (error) return <p className="text-breaking text-sm">{error}</p>;
  if (!anchor) return <p className="text-muted">غير موجود</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">تتبّع التناقض</h1>
        <p className="text-sm text-muted mt-1">
          مقارنة دلالية + حكم AI لنفس الشخصية. التغيّر السياقي لا يُعدّ تناقضاً تلقائياً.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Link href={`/f/${anchor.figureSlug}`} className="font-bold text-accent">
          {anchor.figureName}
        </Link>
        <blockquote className="mt-2 leading-relaxed">«{anchor.text}»</blockquote>
      </div>
      {candidates.length === 0 ? (
        <p className="text-muted text-sm">لم يُرصد تناقض جوهري موثوق في الأرشيف الحالي.</p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c) => (
            <li key={c.id} className="rounded-xl border border-breaking/30 bg-card p-4 space-y-2">
              <p className="text-sm text-breaking font-semibold">{c.explanation}</p>
              <blockquote className="leading-relaxed">«{c.text}»</blockquote>
              <div className="text-xs text-muted flex flex-wrap gap-3">
                <span>تشابه {Math.round(c.similarity * 100)}٪</span>
                {c.topicName && <span>{c.topicName}</span>}
                <a href={c.sourceUrl} className="text-accent" target="_blank" rel="noreferrer">
                  المصدر ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
