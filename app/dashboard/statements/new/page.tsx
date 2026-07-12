import Link from "next/link";
import ManualStatementForm from "@/components/ManualStatementForm";

export const metadata = {
  title: "إدخال تصريح يدوي",
  robots: "noindex, nofollow",
};

export default function NewStatementPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">إدخال تصريح موثق</h1>
        <Link href="/dashboard" className="text-sm text-accent font-semibold hover:underline">
          ← طابور المراجعة
        </Link>
      </div>
      <p className="text-sm text-muted max-w-2xl">
        يُعتمد التصريح فوراً ويظهر للزوار. انسخ النص حرفياً من المصدر مع الرابط والتاريخ.
      </p>
      <ManualStatementForm />
    </div>
  );
}
