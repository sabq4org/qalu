"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

function toHijri(isoDate: string): string {
  if (!isoDate) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(isoDate));
  } catch {
    return "";
  }
}

export default function ManualStatementForm() {
  const router = useRouter();
  const [figures, setFigures] = useState<MetaFigure[]>([]);
  const [topics, setTopics] = useState<MetaTopic[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [figureId, setFigureId] = useState("");
  const [figureQuery, setFigureQuery] = useState("");
  const [figureName, setFigureName] = useState("");
  const [figureTitle, setFigureTitle] = useState("");
  const [verifyFigure, setVerifyFigure] = useState(true);

  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [statementDate, setStatementDate] = useState("");
  const [topicId, setTopicId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [sourceName, setSourceName] = useState("صحيفة سبق");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/meta");
        if (!res.ok) throw new Error();
        const meta = await res.json();
        setFigures(Array.isArray(meta.figures) ? meta.figures : []);
        setTopics(Array.isArray(meta.topics) ? meta.topics : []);
      } catch {
        setError("تعذر تحميل قوائم الشخصيات والمواضيع");
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  const filteredFigures = useMemo(() => {
    const q = figureQuery.trim();
    if (!q) return figures.slice(0, 40);
    return figures.filter(
      (f) => f.name.includes(q) || (f.title ?? "").includes(q),
    );
  }, [figures, figureQuery]);

  const hijri = toHijri(statementDate);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {
        text,
        context: context || null,
        statementDate,
        sourceName,
        sourceUrl,
        sourceTitle: sourceTitle || null,
        verifyFigure,
        topicId: topicId || null,
        topicName: !topicId && topicName.trim() ? topicName.trim() : null,
      };
      if (mode === "existing") {
        if (!figureId) throw new Error("اختر شخصية");
        body.figureId = figureId;
      } else {
        if (!figureName.trim()) throw new Error("اسم الشخصية مطلوب");
        body.figureName = figureName.trim();
        body.figureTitle = figureTitle.trim() || null;
      }

      const res = await fetch("/api/admin/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "تعذر الحفظ");

      setSuccess("تم اعتماد التصريح ونشره");
      setText("");
      setContext("");
      setSourceTitle("");
      setSourceUrl("");
      setTopicId("");
      setTopicName("");
      if (data.figureSlug) {
        setTimeout(() => {
          router.push(`/f/${encodeURIComponent(data.figureSlug)}`);
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  if (loadingMeta) return <p className="text-muted">جارٍ التحميل…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold text-lg">الشخصية</h2>
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 font-semibold ${
              mode === "existing" ? "bg-accent text-accent-contrast" : "border border-border"
            }`}
            onClick={() => setMode("existing")}
          >
            اختيار موجودة
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 font-semibold ${
              mode === "new" ? "bg-accent text-accent-contrast" : "border border-border"
            }`}
            onClick={() => setMode("new")}
          >
            إنشاء جديدة
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <input
              type="search"
              placeholder="بحث بالاسم أو الصفة…"
              value={figureQuery}
              onChange={(e) => setFigureQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            <select
              required
              value={figureId}
              onChange={(e) => setFigureId(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2"
            >
              <option value="">— اختر شخصية —</option>
              {filteredFigures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.title ? ` — ${f.title}` : ""}
                  {f.verified ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              الاسم
              <input
                required
                value={figureName}
                onChange={(e) => setFigureName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              الصفة
              <input
                value={figureTitle}
                onChange={(e) => setFigureTitle(e.target.value)}
                placeholder="وزير المالية، نائب الرئيس…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verifyFigure}
            onChange={(e) => setVerifyFigure(e.target.checked)}
          />
          توثيق الشخصية فوراً (تظهر للزوار)
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold text-lg">التصريح</h2>
        <label className="block text-sm">
          النص الحرفي
          <textarea
            required
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 leading-relaxed"
            placeholder="انسخ النص كما ورد في المصدر حرفياً…"
          />
        </label>
        <label className="block text-sm">
          المناسبة / السياق
          <textarea
            rows={2}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            التاريخ (ميلادي)
            <input
              required
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="block text-sm">
            الموافق هجرياً
            <div className="mt-1 rounded-lg border border-border bg-inner px-3 py-2 text-muted min-h-[42px]">
              {hijri || "—"}
            </div>
          </div>
        </div>

        <label className="block text-sm">
          الموضوع (موجود)
          <select
            value={topicId}
            onChange={(e) => {
              setTopicId(e.target.value);
              if (e.target.value) setTopicName("");
            }}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2"
          >
            <option value="">— بلا / موضوع جديد أدناه —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {!topicId && (
          <label className="block text-sm">
            أو موضوع جديد
            <input
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold text-lg">المصدر</h2>
        <label className="block text-sm">
          اسم المصدر
          <input
            required
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          رابط المقال
          <input
            required
            type="url"
            dir="ltr"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          عنوان المقال (اختياري)
          <input
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-accent-soft text-accent px-4 py-2 text-sm font-semibold">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent text-accent-contrast font-bold px-6 py-2.5 disabled:opacity-50"
      >
        {busy ? "جارٍ الحفظ…" : "اعتماد ونشر"}
      </button>
    </form>
  );
}
