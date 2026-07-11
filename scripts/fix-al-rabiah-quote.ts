try { process.loadEnvFile(".env.local"); } catch { try { process.loadEnvFile(".env"); } catch {} }

const NEW_TEXT =
  "خدمة ضيوف الرحمن ليست مجرد واجب، بل شرف وأمانة مقدسة.. ويجب أنْ تدعم التقنية قيمنا لا أنْ تحل محلها، فكل ما نبنيه يجب أن يعكس التزامنا بالكرامة والإيمان وقدسية رحلة كل ضيف للرحمن";

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { figures, statements } = await import("../db/schema");
  const { dedupeHash } = await import("../lib/arabic");

  const [figure] = await db()
    .select()
    .from(figures)
    .where(eq(figures.slug, "الدكتور-توفيق-الربيعه"))
    .limit(1);
  if (!figure) throw new Error("figure missing");

  const [updated] = await db()
    .update(statements)
    .set({
      text: NEW_TEXT,
      context: "خلال كلمته في مركز أكسفورد للدراسات الإسلامية.",
      statementDate: new Date("2025-04-23"),
      sourceName: "صحيفة سبق",
      sourceUrl: "https://sabq.org",
      sourceTitle: "وزير الحج يستعرض في أكسفورد رؤية المملكة التحولية لخدمة ضيوف الرحمن",
      dedupeHash: dedupeHash(NEW_TEXT, figure.normalizedName),
    })
    .where(eq(statements.id, "c3464b04-6ad8-4874-b075-e40de5e89ff6"))
    .returning();

  console.log({
    id: updated.id,
    date: updated.statementDate,
    context: updated.context,
    sourceName: updated.sourceName,
    sourceUrl: updated.sourceUrl,
    text: updated.text.slice(0, 70) + "…",
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
