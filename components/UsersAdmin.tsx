"use client";

import { useCallback, useEffect, useState } from "react";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  createdAt: string;
}

const ROLES = [
  { value: "admin", label: "مدير" },
  { value: "editor", label: "محرر" },
  { value: "reviewer", label: "مراجع" },
];

export default function UsersAdmin() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("reviewer");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
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
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setEmail("");
      setName("");
      setPassword("");
      setRole("reviewer");
      setOk("تم إنشاء المستخدم");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل");
      setOk("تم التحديث");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحديث");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المستخدمون</h1>

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
        <h2 className="font-bold sm:col-span-2 text-sm">مستخدم جديد</h2>
        <input
          placeholder="الاسم"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <input
          placeholder="البريد"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <input
          type="password"
          placeholder="كلمة المرور (≥8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          onClick={() => void create()}
          className="sm:col-span-2 rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
        >
          إنشاء
        </button>
      </div>

      {loading ? (
        <p className="text-muted">جارٍ التحميل…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap gap-3 items-center justify-between"
            >
              <div>
                <div className="font-semibold">
                  {u.name}{" "}
                  {u.disabled && <span className="text-breaking text-xs">(معطّل)</span>}
                </div>
                <div className="text-xs text-muted">{u.email}</div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={u.role}
                  disabled={busy}
                  onChange={(e) => void patch(u.id, { role: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  disabled={busy}
                  onClick={() => void patch(u.id, { disabled: !u.disabled })}
                  className="text-sm text-accent hover:underline disabled:opacity-50"
                >
                  {u.disabled ? "تفعيل" : "تعطيل"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
