"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface FigureRow {
  id: string;
  name: string;
  title: string | null;
  slug: string;
  imageUrl: string | null;
  verified: boolean;
  displayOrder: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export default function FiguresAdmin() {
  const [items, setItems] = useState<FigureRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ limit: "100" });
      if (q.trim()) sp.set("q", q.trim());
      if (verified) sp.set("verified", verified);
      const res = await fetch(`/api/admin/figures?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
    } catch {
      setError("تعذر تحميل الشخصيات");
    } finally {
      setLoading(false);
    }
  }, [q, verified]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/figures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setNewName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإنشاء");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">الشخصيات ({total})</h1>
        <button onClick={() => void load()} className="text-sm text-accent hover:underline">
          تحديث
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm grow min-w-[12rem]">
          بحث
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اسم أو صفة…"
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5"
          />
        </label>
        <label className="text-sm">
          التوثيق
          <select
            value={verified}
            onChange={(e) => setVerified(e.target.value as "" | "true" | "false")}
            className="mt-1 block rounded-lg border border-border bg-card px-3 py-1.5"
          >
            <option value="">الكل</option>
            <option value="true">موثّقة</option>
            <option value="false">غير موثّقة</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 items-end rounded-xl border border-border bg-card p-3">
        <label className="text-sm grow min-w-[12rem]">
          شخصية جديدة
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="الاسم الكامل"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <button
          disabled={creating || !newName.trim()}
          onClick={() => void create()}
          className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
        >
          إنشاء
        </button>
      </div>

      {loading ? (
        <p className="text-muted">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">لا نتائج</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border text-muted text-right">
              <tr>
                <th className="px-3 py-2 font-semibold">الترتيب</th>
                <th className="px-3 py-2 font-semibold">الاسم</th>
                <th className="px-3 py-2 font-semibold">موثّقة</th>
                <th className="px-3 py-2 font-semibold">معلّق</th>
                <th className="px-3 py-2 font-semibold">معتمد</th>
                <th className="px-3 py-2 font-semibold">مرفوض</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-b border-border/60 hover:bg-card/80">
                  <td className="px-3 py-2 text-muted">{f.displayOrder}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{f.name}</div>
                    {f.title && <div className="text-muted text-xs">{f.title}</div>}
                  </td>
                  <td className="px-3 py-2">{f.verified ? "✓" : "—"}</td>
                  <td className="px-3 py-2">{Number(f.pendingCount)}</td>
                  <td className="px-3 py-2">{Number(f.approvedCount)}</td>
                  <td className="px-3 py-2">{Number(f.rejectedCount)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/figures/${f.id}`} className="text-accent hover:underline">
                      تحرير
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
