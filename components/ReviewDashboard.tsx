"use client";

import { useCallback, useEffect, useState } from "react";

interface PendingStatement {
  id: string;
  text: string;
  context: string | null;
  statementDate: string;
  sourceUrl: string;
  sourceTitle: string | null;
  confidence: number | null;
  figureId: string;
  figureName: string;
  figureTitle: string | null;
  figureVerified: boolean;
  topicId: string | null;
  topicName: string | null;
}

interface MetaFigure {
  id: string;
  name: string;
  title: string | null;
  verified: boolean;
}

interface MetaTopic {
  id: string;
  name: string;
}

function confidenceColor(c: number | null): string {
  if (c == null) return "bg-gray-200 text-gray-700";
  if (c >= 0.85) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (c >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

export default function ReviewDashboard() {
  const [items, setItems] = useState<PendingStatement[]>([]);
  const [total, setTotal] = useState(0);
  const [figures, setFigures] = useState<MetaFigure[]>([]);
  const [topics, setTopics] = useState<MetaTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stRes, metaRes] = await Promise.all([
        fetch("/api/admin/statements?limit=50"),
        fetch("/api/admin/meta"),
      ]);
      if (!stRes.ok || !metaRes.ok) throw new Error("فشل الجلب");
      const st = await stRes.json();
      const meta = await metaRes.json();
      setItems(Array.isArray(st.items) ? st.items : []);
      setTotal(st.total ?? 0);
      setFigures(Array.isArray(meta.figures) ? meta.figures : []);
      setTopics(Array.isArray(meta.topics) ? meta.topics : []);
    } catch {
      setError("تعذر تحميل قائمة المراجعة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/statements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      if (body.action !== "reassign") {
        setItems((prev) => prev.filter((s) => s.id !== id));
        setTotal((t) => Math.max(t - 1, 0));
      } else {
        await load();
      }
      setReassignId(null);
    } catch {
      setError("تعذر تنفيذ الإجراء — أعد المحاولة");
    } finally {
      setBusyId(null);
    }
  }

  async function verifyFigure(figureId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/figures/${figureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("تعذر توثيق الشخصية");
    }
  }

  if (loading) return <p className="text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">تصريحات بانتظار المراجعة ({total})</h1>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard/statements/new"
            className="text-sm font-semibold text-accent hover:underline"
          >
            + إدخال تصريح
          </a>
          <button onClick={() => void load()} className="text-sm text-accent hover:underline">
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-muted">لا تصريحات بانتظار المراجعة 🎉</p>
      ) : (
        items.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold">{s.figureName}</span>
              {s.figureTitle && <span className="text-muted">{s.figureTitle}</span>}
              {s.figureVerified ? (
                <span className="text-accent">✓ موثقة</span>
              ) : (
                <button
                  onClick={() => void verifyFigure(s.figureId)}
                  className="text-xs rounded-full border border-accent text-accent px-2 py-0.5 hover:bg-accent-soft"
                >
                  توثيق الشخصية
                </button>
              )}
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-gold border border-gold/40 bg-gold/10">
                قيد التحقّق
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${confidenceColor(s.confidence)}`}>
                ثقة {s.confidence != null ? Math.round(s.confidence * 100) : "؟"}٪
              </span>
              {s.topicName && (
                <span className="rounded-full bg-accent-soft text-accent px-2 py-0.5 text-xs">
                  {s.topicName}
                </span>
              )}
            </div>

            <blockquote className="leading-relaxed">«{s.text}»</blockquote>

            <div className="text-sm text-muted">
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {s.sourceTitle ?? "المقال المصدر"} ↗
              </a>
              {" · "}
              {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
                new Date(s.statementDate),
              )}
            </div>

            {reassignId === s.id ? (
              <ReassignForm
                statement={s}
                figures={figures}
                topics={topics}
                busy={busyId === s.id}
                onSubmit={(figureId, topicId) =>
                  void act(s.id, { action: "reassign", figureId, topicId })
                }
                onCancel={() => setReassignId(null)}
              />
            ) : (
              <div className="flex gap-2">
                <button
                  disabled={busyId === s.id}
                  onClick={() => void act(s.id, { action: "approve" })}
                  className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  اعتماد
                </button>
                <button
                  disabled={busyId === s.id}
                  onClick={() => void act(s.id, { action: "reject" })}
                  className="rounded-lg border border-breaking/50 text-breaking px-4 py-1.5 text-sm hover:bg-breaking/10 disabled:opacity-50"
                >
                  رفض
                </button>
                <button
                  disabled={busyId === s.id}
                  onClick={() => setReassignId(s.id)}
                  className="rounded-lg border border-border px-4 py-1.5 text-sm hover:border-accent disabled:opacity-50"
                >
                  تصحيح الإسناد
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ReassignForm(props: {
  statement: PendingStatement;
  figures: MetaFigure[];
  topics: MetaTopic[];
  busy: boolean;
  onSubmit: (figureId: string, topicId: string | null) => void;
  onCancel: () => void;
}) {
  const [figureId, setFigureId] = useState(props.statement.figureId);
  const [topicId, setTopicId] = useState<string | null>(props.statement.topicId);

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-background">
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-sm">
          الشخصية
          <select
            value={figureId}
            onChange={(e) => setFigureId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5"
          >
            {props.figures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.title ? ` — ${f.title}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          الموضوع
          <select
            value={topicId ?? ""}
            onChange={(e) => setTopicId(e.target.value || null)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5"
          >
            <option value="">— بلا موضوع —</option>
            {props.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          disabled={props.busy}
          onClick={() => props.onSubmit(figureId, topicId)}
          className="rounded-lg bg-accent text-accent-contrast px-4 py-1.5 text-sm font-bold disabled:opacity-50"
        >
          حفظ
        </button>
        <button onClick={props.onCancel} className="text-sm text-muted hover:text-foreground">
          إلغاء
        </button>
      </div>
    </div>
  );
}
