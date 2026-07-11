import Image from "next/image";

/**
 * صورة الشخصية: دائرية بحلقة تيل (على أسلوب حساب إكس في الهوية — 2f).
 * عند غياب الصورة: الحرف الأول داخل دائرة تيل ناعمة.
 */
export default function FigureAvatar({
  name,
  imageUrl,
  size = 72,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
}) {
  if (!imageUrl) {
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full bg-accent-soft text-accent font-bold shrink-0 ring-2 ring-accent/40"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      >
        {name.trim().charAt(0)}
      </span>
    );
  }
  return (
    <Image
      src={imageUrl}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0 ring-2 ring-accent"
      style={{ width: size, height: size }}
    />
  );
}
