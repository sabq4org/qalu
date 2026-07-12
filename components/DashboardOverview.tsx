"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Overview {
  pendingCount: number;
  approvedLast7Days: number;
  figuresWithoutImage: number;
  figuresWithoutBio: number;
  lastExtractionRun: {
    startedAt: string;
    extracted: number;
    articlesScanned: number;
    failures: number;
  } | null;
  extraction: {
    enabled: boolean;
    batchSize: number;
    saudiGulfOnly: boolean;
    runOnce: boolean;
  };
}

export default function DashboardOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/overview");
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        setError("تعذر تحميل النظرة العامة");
      }
    })();
  }, []);

  if (error) return <p className="text-breaking text-sm">{error}</p>;
  if (!data) return <p className="text-muted">جارٍ التحميل…</p>;

  const cards = [
    {
      label: "معلّق للمراجعة",
      value: data.pendingCount,
      href: "/dashboard/review",
      accent: true,
    },
    { label: "اعتمادات آخر 7 أيام", value: data.approvedLast7Days },
    {
      label: "شخصيات بلا صورة",
      value: data.figuresWithoutImage,
      href: "/dashboard/figures",
    },
    {
      label: "شخصيات بلا سيرة",
      value: data.figuresWithoutBio,
      href: "/dashboard/figures",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">نظرة عامة</h1>
        <Link
          href="/dashboard/review"
          className="rounded-lg bg-accent text-accent-contrast font-bold px-4 py-2 text-sm"
        >
          طابور المراجعة
          {data.pendingCount > 0 ? ` (${data.pendingCount})` : ""}
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-sm text-muted mt-1">{c.label}</div>
            </>
          );
          return c.href ? (
            <Link
              key={c.label}
              href={c.href}
              className={`rounded-xl border p-4 hover:border-accent ${
                c.accent ? "border-accent/50 bg-accent-soft/20" : "border-border bg-card"
              }`}
            >
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-bold">الاستخراج</h2>
          <Link href="/dashboard/extraction" className="text-sm text-accent hover:underline">
            الإعدادات ←
          </Link>
        </div>
        <p className="text-sm text-muted">
          الحالة: {data.extraction.enabled ? "مفعّل" : "معطّل"}
          {" · "}حجم الدفعة {data.extraction.batchSize}
          {data.extraction.saudiGulfOnly ? " · سعودي/خليجي" : ""}
          {data.extraction.runOnce ? " · دفعة معلّقة" : ""}
        </p>
        {data.lastExtractionRun ? (
          <p className="text-sm">
            آخر دفعة:{" "}
            {new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(data.lastExtractionRun.startedAt),
            )}
            {" — "}
            {data.lastExtractionRun.articlesScanned} مقال · {data.lastExtractionRun.extracted}{" "}
            مستخرج
            {data.lastExtractionRun.failures
              ? ` · ${data.lastExtractionRun.failures} فشل`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-muted">لا دفعات مسجّلة بعد</p>
        )}
      </div>

        <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/statements/new" className="text-accent hover:underline font-semibold">
          + إدخال تصريح
        </Link>
        <Link href="/dashboard/publish" className="text-accent hover:underline">
          بطاقات / إكس
        </Link>
        <Link href="/dashboard/figures" className="text-accent hover:underline">
          الشخصيات
        </Link>
        <Link href="/dashboard/topics" className="text-accent hover:underline">
          المواضيع
        </Link>
        <Link href="/dashboard/sources" className="text-accent hover:underline">
          المصادر
        </Link>
      </div>
    </div>
  );
}
