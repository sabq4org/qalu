import { Suspense } from "react";
import SearchExperience from "@/components/SearchExperience";

export const metadata = {
  title: "بحث ذكي",
  description: "ابحث في أرشيف التصريحات بالعربية الطبيعية — فهم بالذكاء الاصطناعي وبحث دلالي.",
  robots: "index, follow",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <Suspense fallback={<p className="text-muted">جارٍ التحميل…</p>}>
      <SearchExperience initialQuery={q ?? ""} />
    </Suspense>
  );
}
