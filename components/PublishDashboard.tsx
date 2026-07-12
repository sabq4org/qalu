"use client";

import { useCallback, useEffect, useState } from "react";

interface ApprovedRow {
  id: string;
  text: string;
  context: string | null;
  statementDate: string;
  sourceUrl: string;
  figureName: string;
  figureTitle: string | null;
  figureSlug: string;
}

type Template = "2d" | "2e" | "3a";

export default function PublishDashboard() {
  const [items, setItems] = useState<ApprovedRow[]>([]);
  const [xConfigured, setXConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("2d");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/approved?limit=40");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setXConfigured(Boolean(data.xConfigured));
    } catch {
      setError("تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function cardUrl(id: string, t: Template) {
    return `/api/admin/cards?id=${encodeURIComponent(id)}&template=${t}`;
  }

  async function download(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(cardUrl(id, template));
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `qalu-${id.slice(0, 8)}-${template}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      setOk("تم تنزيل البطاقة");
    } catch {
      setError("تعذر التنزيل");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(id: string, mode: "intent" | "api") {
    setBusyId(id);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementId: id, template, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.intentUrl) throw new Error(data.message || "فشل");

      if (mode === "api" && data.tweetUrl) {
        setOk(`نُشر: ${data.tweetUrl}`);
        window.open(data.tweetUrl, "_blank");
      } else if (data.intentUrl) {
        // نزّل الصورة ثم افتح intent
        await download(id);
        window.open(data.intentUrl, "_blank");
        setOk(
          mode === "api"
            ? `${data.message || "فشل API"} — فُتح intent مع تنزيل الصورة`
            : "فُتح إكس مع تنزيل البطاقة — أرفق الصورة يدوياً إن لزم",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر النشر");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">بطاقات ونشر إكس</h1>
        <button onClick={() => void load()} className="text-sm text-accent hover:underline">
          تحديث
        </button>
      </div>

      <p className="text-sm text-muted">
        قوالب الهوية: 2d اقتباس 16:9 · 2e مربّع قيد التحقّق · 3a عاجل.{" "}
        {xConfigured
          ? "مفاتيح إكس مضبوطة — يمكن النشر المباشر."
          : "بدون مفاتيح إكس: تنزيل + intent (أرفق الصورة يدوياً)."}
      </p>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-muted">القالب:</span>
        {(
          [
            ["2d", "اقتباس 16:9"],
            ["2e", "مربّع"],
            ["3a", "عاجل"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTemplate(v)}
            className={`rounded-lg px-3 py-1.5 border ${
              template === v
                ? "border-accent bg-accent text-accent-contrast font-bold"
                : "border-border hover:border-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-lg bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 px-4 py-2 text-sm">
          {ok}
        </p>
      )}

      {loading ? (
        <p className="text-muted">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">لا تصريحات معتمدة بعد</p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="text-sm">
                <span className="font-bold">{s.figureName}</span>
                {s.figureTitle && <span className="text-muted"> — {s.figureTitle}</span>}
              </div>
              <blockquote className="leading-relaxed">«{s.text}»</blockquote>
              {activeId === s.id && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardUrl(s.id, template)}
                  alt="معاينة البطاقة"
                  className="w-full max-w-xl rounded-lg border border-border"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busyId === s.id}
                  onClick={() => setActiveId(activeId === s.id ? null : s.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
                >
                  {activeId === s.id ? "إخفاء المعاينة" : "معاينة"}
                </button>
                <button
                  disabled={busyId === s.id}
                  onClick={() => void download(s.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
                >
                  تنزيل PNG
                </button>
                <button
                  disabled={busyId === s.id}
                  onClick={() => void publish(s.id, "intent")}
                  className="rounded-lg bg-accent text-accent-contrast font-bold px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  فتح إكس + تنزيل
                </button>
                {xConfigured && (
                  <button
                    disabled={busyId === s.id}
                    onClick={() => void publish(s.id, "api")}
                    className="rounded-lg border border-accent text-accent px-3 py-1.5 text-sm font-bold disabled:opacity-50"
                  >
                    نشر مباشر @mathaqalu
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
