"use client";

import { useCallback, useEffect, useState } from "react";

interface KeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  webhookUrl: string | null;
  createdAt: string;
}

export default function ApiKeysAdmin() {
  const [items, setItems] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [rawOnce, setRawOnce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/keys");
    const data = await res.json();
    setItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    setRawOnce(null);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, webhookUrl: webhookUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل");
      setRawOnce(data.raw);
      setName("");
      setWebhookUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/admin/keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">مفاتيح API (B2B)</h1>
      <p className="text-sm text-muted">
        استخدم المفتاح مع{" "}
        <code className="text-xs">Authorization: Bearer qalu_…</code> على{" "}
        <code className="text-xs">GET /api/v1/statements</code>
      </p>
      {error && <p className="text-breaking text-sm">{error}</p>}
      {rawOnce && (
        <p className="rounded-lg bg-gold/10 border border-gold/30 px-4 py-2 text-sm break-all">
          احفظ المفتاح الآن (يظهر مرة واحدة): <strong>{rawOnce}</strong>
        </p>
      )}
      <div className="rounded-xl border border-border bg-card p-4 grid gap-2 max-w-lg">
        <input
          placeholder="اسم العميل"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Webhook (اختياري)"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          disabled={busy || !name.trim()}
          onClick={() => void create()}
          className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
        >
          إنشاء مفتاح
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((k) => (
          <li
            key={k.id}
            className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap justify-between gap-2 text-sm"
          >
            <div>
              <div className="font-semibold">
                {k.name}{" "}
                <span className="text-muted font-normal text-xs">{k.keyPrefix}…</span>
              </div>
              {!k.enabled && <span className="text-breaking text-xs">معطّل</span>}
            </div>
            <button
              className="text-accent hover:underline"
              onClick={() => void toggle(k.id, !k.enabled)}
            >
              {k.enabled ? "تعطيل" : "تفعيل"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
