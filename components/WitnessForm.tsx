"use client";

import { useState } from "react";

export default function WitnessForm() {
  const [statementId, setStatementId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    verdict: string;
    matchScore: number | null;
    notes: string | null;
    transcript: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("statementId", statementId.trim());
        if (transcript.trim()) fd.append("transcript", transcript.trim());
        fd.append("audio", file);
        res = await fetch("/api/admin/witness", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/admin/witness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statementId: statementId.trim(),
            transcript: transcript.trim(),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل");
      setResult({
        verdict: data.check.verdict,
        matchScore: data.check.matchScore,
        notes: data.check.notes,
        transcript: data.check.transcript,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  const verdictLabel =
    result?.verdict === "match"
      ? "مطابق للمصدر"
      : result?.verdict === "partial"
        ? "تطابق جزئي"
        : result
          ? "غير مطابق"
          : "";

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-xl font-bold">نسخة الشاهد</h1>
        <p className="text-sm text-muted mt-1">
          الصق تفريغاً أو ارفع مقطعاً صوتياً (Whisper) لمطابقته مع تصريح معتمد.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label className="text-sm block">
          معرّف التصريح
          <input
            value={statementId}
            onChange={(e) => setStatementId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
            required
          />
        </label>
        <label className="text-sm block">
          التفريغ النصي
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
            placeholder="اختياري إن رفعت صوتاً"
          />
        </label>
        <label className="text-sm block">
          ملف صوتي (اختياري)
          <input
            type="file"
            accept="audio/*,video/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !statementId.trim() || (!transcript.trim() && !file)}
          className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "يفحص…" : "مطابقة"}
        </button>
      </form>
      {error && <p className="text-breaking text-sm">{error}</p>}
      {result && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
          <div className="font-bold text-lg">{verdictLabel}</div>
          <p className="text-muted">
            الدرجة: {result.matchScore != null ? `${Math.round(result.matchScore * 100)}٪` : "—"}
          </p>
          {result.notes && <p>{result.notes}</p>}
          <details className="text-xs text-muted">
            <summary>التفريغ المستخدم</summary>
            <p className="mt-2 whitespace-pre-wrap">{result.transcript}</p>
          </details>
        </div>
      )}
    </div>
  );
}
