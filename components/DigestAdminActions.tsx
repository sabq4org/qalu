"use client";

import { useState } from "react";
import DigestView from "@/components/DigestView";

export default function DigestAdminActions() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل");
      setMsg("تم توليد نشرة الأسبوع");
      setKey((k) => k + 1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void generate()}
        className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-2 text-sm disabled:opacity-50"
      >
        {busy ? "يولّد…" : "توليد مساءلة هذا الأسبوع"}
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <DigestView key={key} />
    </div>
  );
}
