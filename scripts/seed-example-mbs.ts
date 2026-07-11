/**
 * إدخال يدوي موثق — سمو ولي العهد الأمير محمد بن سلمان بن عبدالعزيز آل سعود.
 * التشغيل: npx tsx scripts/seed-example-mbs.ts
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
    "الأمير محمد بن سلمان بن عبدالعزيز آل سعود",
    "ولي العهد — رئيس مجلس الوزراء",
  );

  await db()
    .update(figures)
    .set({
      title: "ولي العهد — رئيس مجلس الوزراء",
      bio: "الأمير محمد بن سلمان بن عبدالعزيز آل سعود، ولي العهد منذ 26 رمضان 1438هـ/21 يونيو 2017م، وقائد مسيرة التحول التاريخية في المملكة العربية السعودية، وأول رئيس لمجلس الوزراء السعودي من أحفاد الملك عبدالعزيز، بعدما عُيّن بأمر ملكي من خادم الحرمين الشريفين الملك سلمان بن عبدالعزيز في 1 ربيع الأول 1444هـ/27 سبتمبر 2022م. (المصدر: سعوديبيديا)",
      verified: true,
      updatedAt: new Date(),
    })
    .where(eq(figures.id, figure.id));

  const entries = [
    {
      text: "دائماً ما تبدأ قصص النجاح برؤية، وأنجح الرؤى هي تلك التي تبنى على مكامن القوة",
      context: "قالها مع إطلاق رؤية السعودية 2030.",
      date: new Date("2016-04-25"),
      sourceName: "رؤية السعودية 2030",
      sourceUrl: "https://www.vision2030.gov.sa",
      topic: "الرؤية والمستقبل",
    },
    {
      text: "إننا نعود إلى ما كنا عليه، إسلام وسطي معتدل منفتح على العالم وعلى جميع الأديان.. لن نضيع 30 عاماً أخرى من حياتنا في التعامل مع أي أفكار متطرفة، سوف ندمرهم اليوم وفوراً",
      context: "قالها في مؤتمر مبادرة مستقبل الاستثمار بالرياض.",
      date: new Date("2017-10-24"),
      sourceName: "صحيفة سبق الإلكترونية",
      sourceUrl: "https://sabq.org",
      topic: "محاربة التطرف",
    },
    {
      text: "لن ينجو أي شخص دخل في قضية فساد أياً من كان.. سواء كان وزيراً أو أميراً أو أياً من كان",
      context: "أكد فيها حزم الدولة في قضايا الفساد مع انطلاق حملة مكافحة الفساد.",
      date: new Date("2017-11-08"),
      sourceName: "جريدة الوطن السعودية",
      sourceUrl: "https://www.alwatan.com.sa",
      topic: "مكافحة الفساد",
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
