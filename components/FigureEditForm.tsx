"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface FigureData {
  id: string;
  name: string;
  title: string | null;
  slug: string;
  imageUrl: string | null;
  bio: string | null;
  verified: boolean;
  displayOrder: number;
}

export default function FigureEditForm({
  figureId,
  role,
}: {
  figureId: string;
  role: string;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const canEdit = role === "admin" || role === "editor";

  const [figure, setFigure] = useState<FigureData | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [displayOrder, setDisplayOrder] = useState(1000);
  const [verified, setVerified] = useState(false);
  const [dropFigureId, setDropFigureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/figures/${figureId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const f = data.figure as FigureData;
        setFigure(f);
        setName(f.name);
        setTitle(f.title ?? "");
        setBio(f.bio ?? "");
        setDisplayOrder(f.displayOrder);
        setVerified(f.verified);
      } catch {
        setError("تعذر تحميل الشخصية");
      } finally {
        setLoading(false);
      }
    })();
  }, [figureId]);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/figures/${figureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title: title.trim() || null,
          bio: bio.trim() || null,
          displayOrder: Number(displayOrder) || 1000,
          verified,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل الحفظ");
      setFigure(data.figure);
      setOk("تم الحفظ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/figures/${figureId}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل الرفع");
      setFigure(data.figure);
      setOk("تم رفع الصورة");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر رفع الصورة");
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    if (!canEdit || !dropFigureId.trim()) return;
    if (!confirm("دمج الشخصية المحددة في هذه؟ لا يمكن التراجع.")) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/figures/${figureId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropFigureId: dropFigureId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل الدمج");
      setDropFigureId("");
      setOk("تم الدمج");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الدمج");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!isAdmin) return;
    if (deleteConfirm !== "حذف") {
      setError('اكتب «حذف» للتأكيد');
      return;
    }
    if (!confirm("حذف نهائي مع كل التصريحات؟")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/figures/${figureId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "فشل الحذف");
      router.push("/dashboard/figures");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">جارٍ التحميل…</p>;
  if (!figure) return <p className="text-muted">الشخصية غير موجودة</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">تحرير: {figure.name}</h1>
        <Link href="/dashboard/figures" className="text-sm text-accent hover:underline">
          ← قائمة الشخصيات
        </Link>
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

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {figure.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={figure.imageUrl}
            alt={figure.name}
            className="w-24 h-24 rounded-full object-cover border border-border"
          />
        )}
        {canEdit && (
          <label className="text-sm block">
            صورة
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
              }}
            />
          </label>
        )}

        <label className="text-sm block">
          الاسم
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <label className="text-sm block">
          الصفة
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <label className="text-sm block">
          السيرة
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={!canEdit}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <label className="text-sm block">
          ترتيب العرض
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            disabled={!canEdit}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5"
          />
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            disabled={!canEdit}
          />
          موثّقة
        </label>
        <p className="text-xs text-muted">
          slug: {figure.slug} ·{" "}
          <a href={`/f/${figure.slug}`} className="text-accent hover:underline" target="_blank" rel="noreferrer">
            الصفحة العامة ↗
          </a>
        </p>
        {canEdit && (
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-1.5 text-sm disabled:opacity-50"
          >
            حفظ
          </button>
        )}
      </div>

      {canEdit && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-bold">دمج مكرّر</h2>
          <p className="text-sm text-muted">
            انقل تصريحات شخصية أخرى إلى هذه ثم احذف المكررة. الصق معرّف الشخصية المراد حذفها.
          </p>
          <input
            value={dropFigureId}
            onChange={(e) => setDropFigureId(e.target.value)}
            placeholder="معرّف الشخصية المكررة (UUID)"
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <button
            disabled={busy || !dropFigureId.trim()}
            onClick={() => void merge()}
            className="rounded-lg border border-border px-4 py-1.5 text-sm hover:border-accent disabled:opacity-50"
          >
            دمج
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-xl border border-breaking/40 bg-card p-5 space-y-3">
          <h2 className="font-bold text-breaking">حذف نهائي</h2>
          <p className="text-sm text-muted">يحذف الشخصية وكل تصريحاتها. اكتب «حذف» للتأكيد.</p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <button
            disabled={busy}
            onClick={() => void remove()}
            className="rounded-lg border border-breaking/50 text-breaking px-4 py-1.5 text-sm hover:bg-breaking/10 disabled:opacity-50"
          >
            حذف الشخصية
          </button>
        </div>
      )}
    </div>
  );
}
