import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements, topics } from "@/db/schema";
import { normalizeArabic, slugifyArabic } from "@/lib/arabic";

const approvedCountExpr = sql<number>`count(${statements.id}) filter (where ${statements.status} = 'approved')`;

/**
 * قائمة الشخصيات للعرض العام — الموثقة فقط.
 * غير الموثقة (المستخرجة آلياً) تعيش في لوحة المراجعة ولا تظهر للزوار أبداً.
 */
export async function listFiguresWithCounts(opts: { limit?: number; offset?: number } = {}) {
  const { limit = 24, offset = 0 } = opts;
  return await db()
    .select({
      id: figures.id,
      name: figures.name,
      title: figures.title,
      slug: figures.slug,
      imageUrl: figures.imageUrl,
      verified: figures.verified,
      approvedCount: approvedCountExpr,
    })
    .from(figures)
    .leftJoin(statements, eq(statements.figureId, figures.id))
    .where(eq(figures.verified, true))
    .groupBy(figures.id)
    .orderBy(asc(figures.displayOrder), desc(approvedCountExpr))
    .limit(limit)
    .offset(offset);
}

/** قائمة مبسطة لكل الشخصيات (لقوائم الإسناد في لوحة المراجعة) */
export async function listFiguresBasic() {
  return await db()
    .select({ id: figures.id, name: figures.name, title: figures.title, verified: figures.verified })
    .from(figures)
    .orderBy(desc(figures.verified), figures.name);
}

export async function getFigureBySlug(slug: string) {
  const [figure] = await db().select().from(figures).where(eq(figures.slug, slug)).limit(1);
  return figure ?? null;
}

/** التصريحات المعتمدة لشخصية، الأحدث أولاً، مع موضوع كل تصريح */
export async function getApprovedStatements(
  figureId: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const { limit = 50, offset = 0 } = opts;
  return await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      aiSummary: statements.aiSummary,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceTitle: statements.sourceTitle,
      sourceName: statements.sourceName,
      topicName: topics.name,
    })
    .from(statements)
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(and(eq(statements.figureId, figureId), eq(statements.status, "approved")))
    .orderBy(desc(statements.statementDate))
    .limit(limit)
    .offset(offset);
}

/** أحدث التصريحات المعتمدة عبر كل الشخصيات (للصفحة الرئيسية) */
export async function latestApprovedStatements(limit = 12) {
  return await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceTitle: statements.sourceTitle,
      sourceName: statements.sourceName,
      topicName: topics.name,
      figureName: figures.name,
      figureTitle: figures.title,
      figureSlug: figures.slug,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(eq(statements.status, "approved"))
    .orderBy(desc(statements.statementDate))
    .limit(limit);
}

/** إيجاد شخصية بالاسم المطبع أو إنشاؤها بحالة غير موثقة (يستخدمه worker الاستخراج) */
export async function findOrCreateFigure(name: string, title: string | null) {
  const normalized = normalizeArabic(name);
  const [existing] = await db()
    .select()
    .from(figures)
    .where(eq(figures.normalizedName, normalized))
    .limit(1);
  if (existing) return existing;

  let slug = slugifyArabic(name);
  for (let attempt = 0; ; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const [taken] = await db().select({ id: figures.id }).from(figures).where(eq(figures.slug, candidate)).limit(1);
    if (!taken) {
      slug = candidate;
      break;
    }
  }

  const [created] = await db()
    .insert(figures)
    .values({ name: name.trim(), normalizedName: normalized, title, slug, verified: false })
    .returning();
  return created;
}
