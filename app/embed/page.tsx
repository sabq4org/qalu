export const metadata = { title: "ويدجت التضمين" };

export default function EmbedDocsPage() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qalu.dev";
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold">ويدجت للمواقع</h1>
      <p className="text-sm text-muted leading-relaxed">
        الصق الكود في موقعك لعرض آخر التصريحات المعتمدة لشخصية — مع رابط المصدر.
      </p>
      <pre className="rounded-xl border border-border bg-card p-4 text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
{`<div data-qalu-figure="SLUG" data-limit="3"></div>
<script async src="${site}/embed.js"></script>`}
      </pre>
      <p className="text-sm text-muted">
        استبدل <code className="text-xs">SLUG</code> بمسار الشخصية (مثال من صفحة{" "}
        <code className="text-xs">/f/…</code>).
      </p>
      <div
        data-qalu-figure="placeholder"
        className="text-sm text-muted border border-dashed border-border rounded-xl p-4"
      >
        معاينة حية بعد ضبط slug في الكود أعلاه على صفحتك.
      </div>
    </div>
  );
}
