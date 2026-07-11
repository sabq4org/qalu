/**
 * إدخال يدوي موثق — مثال: خادم الحرمين الشريفين الملك سلمان بن عبدالعزيز.
 * التشغيل: npx tsx scripts/seed-example-salman.ts
 * الإدخال اليدوي يُعتمد مباشرة (منسوخ من مصدره الصحفي المسمى) — عكس مسار الـ AI.
 */
import { eq } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env مصدَّر */
  }
}

async function main() {
  const { db } = await import("../db");
  const { figures, statements } = await import("../db/schema");
  const { dedupeHash } = await import("../lib/arabic");
  const { findOrCreateFigure } = await import("../services/figures");
  const { findOrCreateTopic } = await import("../services/review");

  const figure = await findOrCreateFigure(
    "الملك سلمان بن عبدالعزيز آل سعود",
    "خادم الحرمين الشريفين — ملك المملكة العربية السعودية",
  );

  await db()
    .update(figures)
    .set({
      title: "خادم الحرمين الشريفين — ملك المملكة العربية السعودية",
      bio: "الملك سلمان بن عبدالعزيز بن عبدالرحمن بن فيصل بن تركي بن عبدالله بن محمد بن سعود، خادم الحرمين الشريفين ملك المملكة العربية السعودية، سابع ملوك البلاد، وسادس الحكام وآخرهم من أبناء الملك المؤسس عبدالعزيز بن عبدالرحمن آل سعود، إذ يتولى الحكم منذ 3 ربيع الآخر 1436هـ/23 يناير 2015م، وهو الحاكم الخامس عشر من حكام الدولة السعودية منذ نشأتها في عام 1139هـ/1727م.",
      verified: true,
      updatedAt: new Date(),
    })
    .where(eq(figures.id, figure.id));

  const entries = [
    {
      text: "من دافع عن بلاد الحرمين وحدودها وأمنها الداخلي فهو يدافع عن وطن يستحق منا الدفاع عنه، وشعبنا يستحق منا تحقيق أمنه...",
      context:
        "ألقاها خلال استقباله كبار ضباط القوات العسكرية ووزارات الدفاع والداخلية والحرس الوطني.",
      date: new Date("2015-04-07"),
      sourceName: "جريدة الرياض",
      sourceUrl: "https://www.alriyadh.com",
      topic: "الأمن والدفاع",
    },
    {
      text: "إن الأمن نعمة عظيمة، وهو الأساس في رخاء الشعوب واستقرارها... وأنتم استثمار المستقبل للوطن",
      context:
        "وجهها إلى المواطنين والمواطنات والشباب تأكيداً على دورهم في البناء والحفاظ على الاستقرار.",
      date: new Date("2018-11-10"),
      sourceName: "جريدة الرياض",
      sourceUrl: "https://www.alriyadh.com",
      topic: "الأمن والاستقرار",
    },
    {
      text: "نحمد الله دائمًا على ما أنعم به علينا في هذه البلاد، من أمن واستقرار ورخاء وتنمية، وسنسعى لحاضرنا ومستقبلنا، مستلهمين ذلك من تضحيات الآباء والأجداد",
      context: "أطلقها بمناسبة تدشين الاحتفال الرسمي الأول بيوم التأسيس السعودي.",
      date: new Date("2022-02-22"),
      sourceName: "صحيفة سبق الإلكترونية",
      sourceUrl: "https://sabq.org",
      topic: "يوم التأسيس",
    },
  ];

  for (const e of entries) {
    const topic = await findOrCreateTopic(e.topic);
    const inserted = await db()
      .insert(statements)
      .values({
        figureId: figure.id,
        topicId: topic?.id ?? null,
        text: e.text,
        context: e.context,
        statementDate: e.date,
        sourceArticleId: "manual-entry",
        sourceUrl: e.sourceUrl,
        sourceName: e.sourceName,
        status: "approved",
        confidence: 1,
        dedupeHash: dedupeHash(e.text, figure.normalizedName),
        extractionModel: "manual",
        reviewedAt: new Date(),
      })
      .onConflictDoNothing({ target: statements.dedupeHash })
      .returning({ id: statements.id });
    console.log(inserted.length > 0 ? `أُدخل: ${e.text.slice(0, 40)}…` : `موجود مسبقاً: ${e.text.slice(0, 40)}…`);
  }

  console.log(`\nالصفحة: /f/${encodeURIComponent(figure.slug)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
