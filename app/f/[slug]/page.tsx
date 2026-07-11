import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FigureAvatar from "@/components/FigureAvatar";
import StatementCard, { formatArabicDate } from "@/components/StatementCard";
import { getApprovedStatements, getFigureBySlug } from "@/services/figures";

export const revalidate = 300;

const PAGE_SIZE = 20;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const figure = await getFigureBySlug(decodeURIComponent(slug));
    if (!figure) return { title: "غير موجود" };

    const statements = await getApprovedStatements(figure.id, { limit: 1 });
    const indexable = figure.verified && statements.length > 0;
    const description =
      figure.bio ??
      (statements[0]
        ? `آخر تصريح: «${statements[0].text.slice(0, 160)}»`
        : `تصريحات ${figure.name} الموثقة بالمصدر والتاريخ.`);

    return {
      title: `${figure.name}${figure.title ? ` — ${figure.title}` : ""} | تصريحات موثقة`,
      description: description.slice(0, 220),
      robots: indexable ? "index, follow" : "noindex, follow",
      alternates: { canonical: `${SITE_URL}/f/${encodeURIComponent(figure.slug)}` },
      openGraph: {
        title: `تصريحات ${figure.name}`,
        description: description.slice(0, 220),
        type: "profile",
        locale: "ar_SA",
      },
    };
  } catch {
    return { title: "قالوا", robots: "noindex, follow" };
  }
}

export default async function FigurePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  let figure, statements;
  try {
    figure = await getFigureBySlug(decodeURIComponent(slug));
    if (!figure) notFound();
    statements = await getApprovedStatements(figure.id, {
      limit: PAGE_SIZE + 1, // نجلب واحداً زائداً لمعرفة وجود صفحة تالية
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_")) throw err;
    console.error("[figure-page]", err);
    notFound();
  }

  const hasMore = statements.length > PAGE_SIZE;
  const visible = statements.slice(0, PAGE_SIZE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: figure.name,
    jobTitle: figure.title ?? undefined,
    description: figure.bio ?? undefined,
    url: `${SITE_URL}/f/${encodeURIComponent(figure.slug)}`,
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-l from-transparent via-accent to-transparent" />
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <FigureAvatar name={figure.name} imageUrl={figure.imageUrl} size={104} />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              {figure.name}
              {figure.verified && (
                <span className="text-accent text-xl mr-2" title="شخصية موثقة">✓ موثقة</span>
              )}
            </h1>
            {figure.title && <p className="text-muted mt-2 text-lg">{figure.title}</p>}
            {figure.bio && <p className="mt-4 leading-relaxed">{figure.bio}</p>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">التصريحات الموثقة</h2>
        {visible.length === 0 ? (
          <p className="text-muted">لا تصريحات معتمدة لهذه الشخصية بعد.</p>
        ) : (
          <div className="relative space-y-4 border-r-2 border-accent-soft pr-6">
            {visible.map((s, i) => {
              const year = s.statementDate ? new Date(s.statementDate).getFullYear() : null;
              const prevYear =
                i > 0 && visible[i - 1].statementDate
                  ? new Date(visible[i - 1].statementDate).getFullYear()
                  : null;
              const showYear = year !== null && year !== prevYear;
              return (
                <div key={s.id} className="relative">
                  {showYear && (
                    <div className="relative py-2">
                      <span className="absolute -right-[35px] top-1.5 flex h-5 items-center rounded-full bg-accent px-2 text-[11px] font-bold text-accent-contrast tabular">
                        {year}
                      </span>
                    </div>
                  )}
                  <span className="absolute -right-[31px] top-6 h-3 w-3 rounded-full bg-accent" />
                  <StatementCard
                    text={s.text}
                    statementDate={s.statementDate}
                    sourceUrl={s.sourceUrl}
                    sourceTitle={s.sourceTitle}
                    sourceName={s.sourceName}
                    context={s.context}
                    topicName={s.topicName}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex gap-4 justify-center text-accent font-medium">
          {page > 1 && (
            <Link href={`/f/${encodeURIComponent(figure.slug)}?page=${page - 1}`}>
              → الأحدث
            </Link>
          )}
          {hasMore && (
            <Link href={`/f/${encodeURIComponent(figure.slug)}?page=${page + 1}`}>
              الأقدم ←
            </Link>
          )}
        </div>

        {visible.length > 0 && (
          <p className="mt-8 text-xs text-muted text-center">
            آخر تحديث للصفحة: {formatArabicDate(new Date())} — الملخصات والتصنيفات مولدة
            آلياً؛ نص كل تصريح منقول حرفياً من مصدره.
          </p>
        )}
      </section>
    </div>
  );
}
