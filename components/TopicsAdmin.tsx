"use client";

import { useCallback, useEffect, useState } from "react";

interface TopicRow {
  id: string;
  name: string;
  statementCount: number;
}

export default function TopicsAdmin() {
  const [items, setItems] = useState<TopicRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeKeepId, setMergeKeepId] = useState("");
  const [mergeDropId, setMergeDropId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ limit: "200" });
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/admin/topics?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
    } catch {
      setError("تعذر تحميل المواضيع");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewName("");
      setOk("تم الإنشاء");
      await load();
    } catch {
      setError("تعذر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!editId || !editName.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/topics/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setEditId(null);
      setOk("تم إعادة التسمية");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    if (!mergeKeepId || !mergeDropId) return;
    if (!confirm("دمج الموضوعين؟ التصريحات تنتقل إلى الموضوع المحتفظ به.")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/topics/${mergeKeepId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropTopicId: mergeDropId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setMergeDropId("");
      setOk("تم الدمج");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الدمج");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف الموضوع إن لم يُستخدم؟")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setOk("تم الحذف");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">المواضيع ({total})</h1>
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

      <label className="text-sm block max-w-md">
        بحث
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5"
        />
      </label>

      <div className="flex flex-wrap gap-2 items-end rounded-xl border border-border bg-card p-3">
        <label className="text-sm grow min-w-[12rem]">
          موضوع جديد
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <button
          disabled={busy || !newName.trim()}
          onClick={() => void create()}
          className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
        >
          إنشاء
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <h2 className="font-bold text-sm">دمج موضوعين</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-sm">
            الاحتفاظ بـ
            <select
              value={mergeKeepId}
              onChange={(e) => setMergeKeepId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
            >
              <option value="">— اختر —</option>
              {items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            دمج (حذف)
            <select
              value={mergeDropId}
              onChange={(e) => setMergeDropId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
            >
              <option value="">— اختر —</option>
              {items
                .filter((t) => t.id !== mergeKeepId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <button
          disabled={busy || !mergeKeepId || !mergeDropId}
          onClick={() => void merge()}
          className="rounded-lg border border-border px-4 py-1.5 text-sm hover:border-accent disabled:opacity-50"
        >
          دمج
        </button>
      </div>

      {loading ? (
        <p className="text-muted">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="text-muted">لا نتائج</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
            >
              {editId === t.id ? (
                <div className="flex flex-wrap gap-2 grow items-center">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm grow min-w-[10rem]"
                  />
                  <button
                    disabled={busy}
                    onClick={() => void saveRename()}
                    className="rounded-lg bg-accent text-accent-contrast px-3 py-1 text-sm font-bold disabled:opacity-50"
                  >
                    حفظ
                  </button>
                  <button onClick={() => setEditId(null)} className="text-sm text-muted">
                    إلغاء
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted">{Number(t.statementCount)} تصريح</div>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => {
                        setEditId(t.id);
                        setEditName(t.name);
                      }}
                      className="text-accent hover:underline"
                    >
                      إعادة تسمية
                    </button>
                    <button
                      disabled={busy || Number(t.statementCount) > 0}
                      onClick={() => void remove(t.id)}
                      className="text-breaking hover:underline disabled:opacity-40"
                      title={Number(t.statementCount) > 0 ? "ادمج أولاً" : undefined}
                    >
                      حذف
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
