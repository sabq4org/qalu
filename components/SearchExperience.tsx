"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import StatementCard from "@/components/StatementCard";

interface Hit {
  id: string;
  text: string;
  context: string | null;
  statementDate: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceName: string;
  figureName: string;
  figureTitle: string | null;
  figureSlug: string;
  topicName: string | null;
  score: number;
  matchType: string;
}

interface Interpretation {
  keywords: string[];
  figureHints: string[];
  topicHints: string[];
  yearFrom?: number | null;
  yearTo?: number | null;
  rewrittenQuery?: string;
  intent?: string;
}

type Mode = "hybrid" | "keyword" | "semantic";

export default function SearchExperience({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery || searchParams.get("q") || "");
  const [mode, setMode] = useState<Mode>((searchParams.get("mode") as Mode) || "hybrid");
  const [items, setItems] = useState<Hit[]>([]);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (query: string, searchMode: Mode, pushUrl: boolean) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setItems([]);
        setInterpretation(null);
        setTookMs(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams({ q: trimmed, mode: searchMode, limit: "24" });
        const res = await fetch(`/api/search?${sp}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "فشل البحث");
        setItems(Array.isArray(data.items) ? data.items : []);
        setInterpretation(data.interpretation ?? null);
        setTookMs(typeof data.tookMs === "number" ? data.tookMs : null);
        if (pushUrl) {
          startTransition(() => {
            router.replace(`/search?${sp.toString()}`, { scroll: false });
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر البحث");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const initial = (initialQuery || searchParams.get("q") || "").trim();
    if (initial.length >= 2) void run(initial, mode, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void run(q, mode, true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold mb-1">بحث ذكي</h1>
        <p className="text-sm text-muted">
          اسأل بالعربية الطبيعية — مثل «ماذا قال الجدعان عن الميزانية؟» أو «تصريحات ولي العهد عن رؤية
          2030».
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اكتب سؤالك أو كلمات البحث…"
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base sm:text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || pending || q.trim().length < 2}
            className="rounded-xl bg-accent text-accent-contrast font-bold px-5 py-3 text-sm disabled:opacity-50"
          >
            {loading ? "جارٍ البحث…" : "بحث"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
          {(
            [
              ["hybrid", "هجين (موصى به)"],
              ["semantic", "دلالي AI"],
              ["keyword", "كلمات فقط"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                if (q.trim().length >= 2) void run(q, value, true);
              }}
              className={`rounded-lg px-3 py-1.5 border ${
                mode === value
                  ? "border-accent bg-accent text-accent-contrast font-bold"
                  : "border-border hover:border-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <p className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </p>
      )}

      {interpretation && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm space-y-1">
          <div className="font-semibold text-accent">فهم الاستعلام</div>
          {interpretation.rewrittenQuery && (
            <p className="text-muted">إعادة صياغة: {interpretation.rewrittenQuery}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs pt-1">
            {interpretation.figureHints?.map((h) => (
              <span key={h} className="rounded-full bg-accent-soft text-accent px-2 py-0.5">
                شخصية: {h}
              </span>
            ))}
            {interpretation.topicHints?.map((h) => (
              <span key={h} className="rounded-full border border-border px-2 py-0.5">
                موضوع: {h}
              </span>
            ))}
            {(interpretation.yearFrom || interpretation.yearTo) && (
              <span className="rounded-full border border-border px-2 py-0.5">
                سنة: {interpretation.yearFrom ?? "…"}–{interpretation.yearTo ?? "…"}
              </span>
            )}
          </div>
          {tookMs != null && (
            <p className="text-xs text-muted pt-1">
              {items.length} نتيجة · {tookMs}ms · وضع {mode}
            </p>
          )}
        </div>
      )}

      {loading && <p className="text-muted text-sm">يحلّل الاستعلام ويبحث دلالياً…</p>}

      {!loading && q.trim().length >= 2 && items.length === 0 && !error && (
        <p className="text-muted text-sm">لا نتائج — جرّب صياغة أخرى أو الوضع الهجين.</p>
      )}

      <div className="space-y-4">
        {items.map((s) => (
          <div key={s.id} className="relative">
            <div className="absolute left-3 top-3 z-10 text-[10px] sm:text-xs text-muted bg-background/80 rounded px-1.5 py-0.5 border border-border">
              {Math.round(s.score * 100)}٪ ·{" "}
              {s.matchType === "semantic" ? "دلالي" : s.matchType === "hybrid" ? "هجين" : "نصي"}
            </div>
            <StatementCard
              text={s.text}
              statementDate={s.statementDate}
              sourceUrl={s.sourceUrl}
              sourceTitle={s.sourceTitle}
              sourceName={s.sourceName}
              context={s.context}
              topicName={s.topicName}
              figureName={s.figureName}
              figureTitle={s.figureTitle}
              figureSlug={s.figureSlug}
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted text-center">
        البحث الدلالي يعتمد على فهرس التضمينات للتصريحات المعتمدة.{" "}
        <Link href="/" className="text-accent hover:underline">
          العودة للرئيسية
        </Link>
      </p>
    </div>
  );
}
