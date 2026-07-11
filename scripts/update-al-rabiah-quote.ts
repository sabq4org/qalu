/**
 * تحديث مقولة وزير الحج المنشورة.
 * التشغيل: npx tsx scripts/update-al-rabiah-quote.ts
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env مصدَّر */
  }
}

const NEW_TEXT =
  "خدمة ضيوف الرحمن ليست مجرد واجب، بل شرف وأمانة مقدسة.. ويجب أنْ تدعم التقنية قيمنا لا أنْ تحل محلها، فكل ما نبنيه يجب أن يعكس التزامنا بالكرامة والإيمان وقدسية رحلة كل ضيف للرحمن";

const NEW_CONTEXT = "أُلقيت هذه المقولة في 23 أبريل 2025.";
const NEW_DATE = new Date("2025-04-23");

async function main() {
  const { eq, desc } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { figures, statements } = await import("../db/schema");
  const { dedupeHash } = await import("../lib/arabic");
  const { revalidatePath, revalidateTag } = await import("next/cache").catch(() => ({
    revalidatePath: null,
    revalidateTag: null,
  }));

  const [figure] = await db()
    .select()
    .from(figures)
    .where(eq(figures.slug, "الدكتور-توفيق-الربيعه"))
    .limit(1);

  if (!figure) {
    console.error("لم يُعثر على الشخصية");
    process.exit(1);
  }

  const rows = await db()
    .select()
    .from(statements)
    .where(eq(statements.figureId, figure.id))
    .orderBy(desc(statements.statementDate));

  console.log(
    "before:",
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      date: r.statementDate,
      text: r.text.slice(0, 60) + "…",
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
    })),
  );

  const approved = rows.filter((r) => r.status === "approved");
  const target = approved[0] ?? rows[0];
  if (!target) {
    console.error("لا توجد مقولات لهذه الشخصية");
    process.exit(1);
  }

  const hash = dedupeHash(NEW_TEXT, figure.id);

  const [updated] = await db()
    .update(statements)
    .set({
      text: NEW_TEXT,
      context: NEW_CONTEXT,
      statementDate: NEW_DATE,
      sourceName: "صحيفة سبق",
      sourceUrl: target.sourceUrl?.includes("sabq")
        ? target.sourceUrl
        : "https://sabq.org",
      dedupeHash: hash,
    })
    .where(eq(statements.id, target.id))
    .returning();

  console.log("updated:", {
    id: updated.id,
    status: updated.status,
    date: updated.statementDate,
    sourceName: updated.sourceName,
    sourceUrl: updated.sourceUrl,
    text: updated.text.slice(0, 80) + "…",
    context: updated.context,
  });

  // next/cache لا يعمل خارج خادم Next — تجاهل إن فشل
  void revalidatePath;
  void revalidateTag;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
