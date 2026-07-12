"use client";

import { useCallback, useEffect, useState } from "react";

interface SourceRow {
  id: string;
  name: string;
  slug: string;
  rssUrl: string | null;
  enabled: boolean;
  lastFetchedAt: string | null;
  articlesPulled: number;
  statementsExtracted: number;
  notes: string | null;
}

export default function SourcesAdmin() {
  const [items, setItems] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          rssUrl: rssUrl.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setName("");
      setRssUrl("");
      setNotes("");
      setOk("تمت إضافة المصدر");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("تعذر التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, slug: string) {
    if (slug === "sabq") {
      setError("لا يُحذف مصدر سبق — عطّله إن لزم");
      return;
    }
    if (!confirm("حذف المصدر؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sources?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("تعذر الحذف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المصادر</h1>
      <p className="text-sm text-muted">
        سبق يعمل عبر أرشيف Postgres. مصادر RSS الإضافية تُسجَّل هنا وتُفعَّل عند تفعيل أداة السحب لاحقاً.
      </p>

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

      <div className="rounded-xl border border-border bg-card p-4 grid sm:grid-cols-2 gap-2 max-w-2xl">
        <h2 className="font-bold sm:col-span-2 text-sm">مصدر جديد (RSS)</h2>
        <input
          placeholder="اسم الصحيفة"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <input
          placeholder="رابط RSS"
          value={rssUrl}
          onChange={(e) => setRssUrl(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <input
          placeholder="ملاحظات"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          disabled={busy || !name.trim()}
          onClick={() => void create()}
          className="sm:col-span-2 rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
        >
          إضافة
        </button>
      </div>

      {loading ? (
        <p className="text-muted">جارٍ التحميل…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap gap-3 justify-between items-center"
            >
              <div>
                <div className="font-semibold">
                  {s.name}{" "}
                  <span className="text-xs text-muted font-normal">({s.slug})</span>
                  {!s.enabled && <span className="text-breaking text-xs mr-2">معطّل</span>}
                </div>
                <div className="text-xs text-muted mt-1">
                  {s.rssUrl ? s.rssUrl : "أرشيف مباشر (بدون RSS)"}
                  {" · "}
                  سُحب {s.articlesPulled} مقال · استُخرج {s.statementsExtracted}
                  {s.lastFetchedAt
                    ? ` · آخر سحب ${new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(new Date(s.lastFetchedAt))}`
                    : ""}
                </div>
                {s.notes && <div className="text-xs text-muted mt-0.5">{s.notes}</div>}
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  disabled={busy}
                  onClick={() => void toggle(s.id, !s.enabled)}
                  className="text-accent hover:underline disabled:opacity-50"
                >
                  {s.enabled ? "إيقاف" : "تفعيل"}
                </button>
                {s.slug !== "sabq" && (
                  <button
                    disabled={busy}
                    onClick={() => void remove(s.id, s.slug)}
                    className="text-breaking hover:underline disabled:opacity-50"
                  >
                    حذف
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
