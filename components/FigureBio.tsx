"use client";

import { useEffect, useRef, useState } from "react";

/** نبذة الشخصية: سطران على الجوال مع «المزيد»، كاملة على الشاشات الأوسع */
export default function FigureBio({ bio }: { bio: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);

  useEffect(() => {
    function measure() {
      const el = textRef.current;
      if (!el) return;
      // على سطح المكتب لا نقتصر — الزر للجوال فقط
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      if (!isMobile) {
        setNeedsClamp(false);
        return;
      }
      if (expanded) {
        // عند التوسيع نفترض أن الزر يبقى إن كان النص طويلاً أصلاً
        return;
      }
      // قارن مع clamp مؤقت
      const overflowed = el.scrollHeight > el.clientHeight + 1;
      setNeedsClamp(overflowed);
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [bio, expanded]);

  return (
    <div className="mt-4">
      <p
        ref={textRef}
        className={`leading-relaxed ${
          expanded ? "" : "line-clamp-2 sm:line-clamp-none"
        }`}
      >
        {bio}
      </p>
      {needsClamp && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-sm font-semibold text-accent hover:underline sm:hidden"
        >
          {expanded ? "أقل" : "المزيد"}
        </button>
      )}
    </div>
  );
}
