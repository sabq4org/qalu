/**
 * الشعار المعتمد (خيار 1c في الهوية): «؟» داخل مربّع تيل + الاسم الكتابي.
 * لا فصل «؟» عن المربّع، لا تدوير، لا تغيير لون المربّع (قواعد 2g).
 */
export function QMark({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center bg-accent text-accent-contrast font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        fontSize: Math.round(size * 0.62),
      }}
    >
      ؟
    </span>
  );
}

export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="font-bold text-foreground" style={{ fontSize: Math.round(size * 0.62) }}>
        ماذا قالوا
      </span>
      <QMark size={size} />
    </span>
  );
}
