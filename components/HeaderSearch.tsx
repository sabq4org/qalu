"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** شريط بحث مختصر في الهيدر */
export default function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1.5 max-w-[14rem] sm:max-w-xs w-full">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="بحث ذكي…"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:border-accent"
        aria-label="بحث ذكي"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-accent text-accent-contrast px-2.5 py-1.5 text-xs sm:text-sm font-bold"
      >
        بحث
      </button>
    </form>
  );
}
