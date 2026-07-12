"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PendingStatement {
  id: string;
  text: string;
  context: string | null;
  statementDate: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceName?: string | null;
  confidence: number | null;
  status?: string;
  rejectionReason?: string | null;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [status, setStatus] = useState<"pending" | "rejected">("pending");
  const [figureId, setFigureId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [q, setQ] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectPrompt, setShowRejectPrompt] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ limit: "50", status });
      if (figureId) sp.set("figureId", figureId);
      if (topicId) sp.set("topicId", topicId);
      if (minConfidence) sp.set("minConfidence", minConfidence);
      if (q.trim()) sp.set("q", q.trim());
      if (sourceName.trim()) sp.set("sourceName", sourceName.trim());
      const [stRes, metaRes] = await Promise.all([
        fetch(`/api/admin/statements?${sp}`),
        fetch("/api/admin/meta"),
      ]);
      if (!stRes.ok || !metaRes.ok) throw new Error("فشل الجلب");
      const st = await stRes.json();
      const meta = await metaRes.json();
      setItems(Array.isArray(st.items) ? st.items : []);
      setTotal(st.total ?? 0);
      setFigures(Array.isArray(meta.figures) ? meta.figures : []);
      setTopics(Array.isArray(meta.topics) ? meta.topics : []);
      setSelected(new Set());
      setFocusIdx(0);
    } catch {
      setError("تعذر تحميل قائمة المراجعة");
    } finally {
      setLoading(false);
    }
  }, [status, figureId, topicId, minConfidence, q, sourceName]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    cardRefs.current[focusIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusIdx]);

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
      if (body.action === "reassign") {
        await load();
      } else {
        setItems((prev) => prev.filter((s) => s.id !== id));
        setTotal((t) => Math.max(t - 1, 0));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      setReassignId(null);
      setShowRejectPrompt(null);
      setRejectReason("");
    } catch {
      setError("تعذر تنفيذ الإجراء — أعد المحاولة");
    } finally {
      setBusyId(null);
    }
  }

  async function bulk(action: "approve" | "reject" | "restore") {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusyId("bulk");
    setError(null);
    try {
      const res = await fetch("/api/admin/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ids,
          reason: action === "reject" ? rejectReason || undefined : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("تعذر الإجراء الجماعي");
    } finally {
      setBusyId(null);
    }
  }

  async function verifyFigure(fid: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/figures/${fid}`, {
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((s) => s.id)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (items.length === 0) return;
      const focused = items[focusIdx];
      if (!focused) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (status === "pending") void act(focused.id, { action: "approve" });
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (status === "pending") setShowRejectPrompt(focused.id);
        else void act(focused.id, { action: "restore" });
      } else if (e.key === " ") {
        e.preventDefault();
        toggleSelect(focused.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) return <p className="text-muted">جارٍ التحميل…</p>;

  const title =
    status === "rejected" ? `تصريحات مرفوضة (${total})` : `تصريحات بانتظار المراجعة (${total})`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{title}</h1>
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

      <p className="text-xs text-muted">
        اختصارات: ↑↓ أو j/k للتنقل · A اعتماد · R رفض/استرجاع · مسافة تحديد
      </p>

      <div className="rounded-xl border border-border bg-card p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <label className="text-sm">
          الحالة
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "pending" | "rejected")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
          >
            <option value="pending">معلّق</option>
            <option value="rejected">مرفوض</option>
          </select>
        </label>
        <label className="text-sm">
          الشخصية
          <select
            value={figureId}
            onChange={(e) => setFigureId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
          >
            <option value="">الكل</option>
            {figures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          الموضوع
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
          >
            <option value="">الكل</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          حد أدنى للثقة (0–1)
          <input
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            placeholder="مثل 0.7"
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          بحث نصي
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          اسم المصدر
          <input
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
          />
        </label>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2 items-center rounded-xl border border-accent/40 bg-accent-soft/30 px-4 py-2">
          <span className="text-sm font-semibold">{selected.size} محدد</span>
          {status === "pending" ? (
            <>
              <button
                disabled={busyId === "bulk"}
                onClick={() => void bulk("approve")}
                className="rounded-lg bg-accent text-accent-contrast font-bold px-3 py-1 text-sm disabled:opacity-50"
              >
                اعتماد الكل
              </button>
              <button
                disabled={busyId === "bulk"}
                onClick={() => void bulk("reject")}
                className="rounded-lg border border-breaking/50 text-breaking px-3 py-1 text-sm disabled:opacity-50"
              >
                رفض الكل
              </button>
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="سبب الرفض (اختياري)"
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm grow min-w-[8rem]"
              />
            </>
          ) : (
            <button
              disabled={busyId === "bulk"}
              onClick={() => void bulk("restore")}
              className="rounded-lg bg-accent text-accent-contrast font-bold px-3 py-1 text-sm disabled:opacity-50"
            >
              استرجاع للكل
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-muted">
          {status === "rejected" ? "لا تصريحات مرفوضة" : "لا تصريحات بانتظار المراجعة 🎉"}
        </p>
      ) : (
        <>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size === items.length && items.length > 0}
              onChange={toggleAll}
            />
            تحديد الكل
          </label>
          {items.map((s, idx) => (
            <div
              key={s.id}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              className={`rounded-xl border bg-card p-5 space-y-3 ${
                focusIdx === idx ? "border-accent ring-1 ring-accent/40" : "border-border"
              }`}
              onClick={() => setFocusIdx(idx)}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  onClick={(e) => e.stopPropagation()}
                />
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
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${
                    status === "rejected"
                      ? "text-breaking border-breaking/40 bg-breaking/10"
                      : "text-gold border-gold/40 bg-gold/10"
                  }`}
                >
                  {status === "rejected" ? "مرفوض" : "قيد التحقّق"}
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
              {s.context && <p className="text-sm text-muted">سياق: {s.context}</p>}
              {s.rejectionReason && (
                <p className="text-sm text-breaking">سبب الرفض: {s.rejectionReason}</p>
              )}

              <div className="text-sm text-muted">
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {s.sourceTitle ?? "المقال المصدر"} ↗
                </a>
                {s.sourceName ? ` · ${s.sourceName}` : ""}
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
                  onSubmit={(fid, tid, context) =>
                    void act(s.id, { action: "reassign", figureId: fid, topicId: tid, context })
                  }
                  onCancel={() => setReassignId(null)}
                />
              ) : showRejectPrompt === s.id ? (
                <div className="rounded-lg border border-border p-3 space-y-2 bg-background">
                  <label className="text-sm block">
                    سبب الرفض (اختياري)
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === s.id}
                      onClick={() =>
                        void act(s.id, { action: "reject", reason: rejectReason || undefined })
                      }
                      className="rounded-lg border border-breaking/50 text-breaking px-4 py-1.5 text-sm font-bold disabled:opacity-50"
                    >
                      تأكيد الرفض
                    </button>
                    <button
                      onClick={() => {
                        setShowRejectPrompt(null);
                        setRejectReason("");
                      }}
                      className="text-sm text-muted"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {status === "pending" ? (
                    <>
                      <button
                        disabled={busyId === s.id}
                        onClick={() => void act(s.id, { action: "approve" })}
                        className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        اعتماد
                      </button>
                      <button
                        disabled={busyId === s.id}
                        onClick={() => setShowRejectPrompt(s.id)}
                        className="rounded-lg border border-breaking/50 text-breaking px-4 py-1.5 text-sm hover:bg-breaking/10 disabled:opacity-50"
                      >
                        رفض
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busyId === s.id}
                      onClick={() => void act(s.id, { action: "restore" })}
                      className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
                    >
                      استرجاع للمعلّق
                    </button>
                  )}
                  <button
                    disabled={busyId === s.id}
                    onClick={() => setReassignId(s.id)}
                    className="rounded-lg border border-border px-4 py-1.5 text-sm hover:border-accent disabled:opacity-50"
                  >
                    تصحيح / سياق
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ReassignForm(props: {
  statement: PendingStatement;
  figures: MetaFigure[];
  topics: MetaTopic[];
  busy: boolean;
  onSubmit: (figureId: string, topicId: string | null, context: string | null) => void;
  onCancel: () => void;
}) {
  const [figureId, setFigureId] = useState(props.statement.figureId);
  const [topicId, setTopicId] = useState<string | null>(props.statement.topicId);
  const [context, setContext] = useState(props.statement.context ?? "");

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
      <label className="text-sm block">
        السياق
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5"
        />
      </label>
      <div className="flex gap-2">
        <button
          disabled={props.busy}
          onClick={() => props.onSubmit(figureId, topicId, context.trim() || null)}
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
