"use client";

import { useCallback, useEffect, useState } from "react";

interface Settings {
  enabled: boolean;
  batchSize: number;
  saudiGulfOnly: boolean;
  runOnce: boolean;
}

interface Run {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  articlesScanned: number;
  extracted: number;
  rejectedVerbatim: number;
  duplicates: number;
  failures: number;
  notes: string | null;
}

export default function ExtractionOps() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/extraction");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSettings(data.settings);
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch {
      setError("تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<Settings>) {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/extraction", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setSettings(data.settings);
      setOk("تم حفظ الإعدادات");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function runOnce() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runOnce" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setOk(data.message ?? "طُلبت دفعة");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الطلب");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">جارٍ التحميل…</p>;
  if (!settings) return <p className="text-muted">لا بيانات</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">الاستخراج</h1>
        <button onClick={() => void load()} className="text-sm text-accent hover:underline">
          تحديث
        </button>
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

      <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-lg">
        <h2 className="font-bold">الإعدادات</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => void save({ enabled: e.target.checked })}
            disabled={busy}
          />
          الاستخراج مفعّل (الدفعات المجدولة)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.saudiGulfOnly}
            onChange={(e) => void save({ saudiGulfOnly: e.target.checked })}
            disabled={busy}
          />
          سعودي / خليجي فقط
        </label>
        <label className="text-sm block">
          حجم الدفعة
          <input
            type="number"
            min={1}
            max={200}
            value={settings.batchSize}
            onChange={(e) =>
              setSettings({ ...settings, batchSize: Number(e.target.value) || 50 })
            }
            onBlur={() => void save({ batchSize: settings.batchSize })}
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            disabled={busy}
            onClick={() => void runOnce()}
            className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
          >
            دفعة الآن
          </button>
          {settings.runOnce && (
            <span className="text-xs text-gold">طلب دفعة معلّق للـ worker…</span>
          )}
        </div>
        <p className="text-xs text-muted">
          «دفعة الآن» تضع علماً يلتقطه الـ worker في دورته التالية (بدون timeout على الويب).
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold">آخر الدفعات</h2>
        {runs.length === 0 ? (
          <p className="text-muted text-sm">لا سجلات بعد</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border text-muted text-right">
                <tr>
                  <th className="px-3 py-2">البداية</th>
                  <th className="px-3 py-2">مقالات</th>
                  <th className="px-3 py-2">مستخرج</th>
                  <th className="px-3 py-2">مرفوض حرفي</th>
                  <th className="px-3 py-2">مكرر</th>
                  <th className="px-3 py-2">فشل</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      {new Intl.DateTimeFormat("ar", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(r.startedAt))}
                    </td>
                    <td className="px-3 py-2">{r.articlesScanned}</td>
                    <td className="px-3 py-2">{r.extracted}</td>
                    <td className="px-3 py-2">{r.rejectedVerbatim}</td>
                    <td className="px-3 py-2">{r.duplicates}</td>
                    <td className="px-3 py-2">{r.failures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
