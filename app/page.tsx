import Link from "next/link";
import FigureAvatar from "@/components/FigureAvatar";
import StatementCard from "@/components/StatementCard";
import { latestApprovedStatements, listFiguresWithCounts } from "@/services/figures";

export const revalidate = 300;

export const metadata = {
  alternates: { canonical: "/" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "ماذا قالوا؟",
      alternateName: "Qalu",
      url: SITE_URL,
      description:
        "أرشيف موثق لتصريحات الشخصيات العامة العربية — النص الحرفي، بمصدره، بتاريخه.",
      inLanguage: "ar",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "ماذا قالوا؟",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
  ],
};

async function loadHomeData() {
  try {
    const [figures, statements] = await Promise.all([
      listFiguresWithCounts({ limit: 8 }),
      latestApprovedStatements(12),
    ]);
    return { figures, statements };
  } catch (err) {
    // أثناء البناء أو قبل تهيئة القاعدة نعرض صفحة فارغة بدل الفشل
    console.error("[home]", err);
    return { figures: [], statements: [] };
  }
}

export default async function HomePage() {
  const { figures, statements } = await loadHomeData();

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card text-center py-14 px-8">
        <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-l from-transparent via-accent to-transparent" />
        <h1 className="text-4xl font-bold mb-4">
          ماذا قالوا<span className="text-accent">؟</span>
        </h1>
        <p className="text-sm font-semibold text-muted mb-6">
          القول الفصل في التصريحات
        </p>
        <p className="text-muted max-w-2xl mx-auto leading-relaxed">
          نرصد ما قيل، متى قيل، وممّن قيل — بدقة وبلا تهويل. تصريحات الوزراء والمسؤولين
          والرياضيين ورجال الأعمال كما وردت حرفياً في الصحافة، كل تصريح برابط مقاله الأصلي
          وتاريخه، بلا اجتزاء ولا إعادة صياغة.
        </p>
      </section>

      {figures.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">الشخصيات</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {figures.map((f) => (
              <Link
                key={f.id}
                href={`/f/${encodeURIComponent(f.slug)}`}
                className="rounded-xl border border-border bg-card p-4 text-center hover:border-accent transition-colors"
              >
                <div className="mb-3 flex justify-center">
                  <FigureAvatar name={f.name} imageUrl={f.imageUrl} size={72} />
                </div>
                <div className="font-bold">
                  {f.name}
                  {f.verified && <span className="text-accent mr-1" title="موثقة">✓</span>}
                </div>
                {f.title && <div className="text-sm text-muted mt-1">{f.title}</div>}
                <div className="text-xs text-muted mt-2">{f.approvedCount} تصريحاً</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-4">أحدث التصريحات</h2>
        {statements.length === 0 ? (
          <p className="text-muted">لا تصريحات معتمدة بعد — الأرشيف قيد البناء.</p>
        ) : (
          <div className="space-y-4">
            {statements.map((s) => (
              <StatementCard
                key={s.id}
                text={s.text}
                statementDate={s.statementDate}
                sourceUrl={s.sourceUrl}
                sourceTitle={s.sourceTitle}
                sourceName={s.sourceName}
                context={s.context}
                topicName={s.topicName}
                figureName={s.figureName}
                figureTitle={s.figureTitle}
                figureSlug={s.figureSlug}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
