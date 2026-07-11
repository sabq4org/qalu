import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements, topics } from "@/db/schema";
import { normalizeArabic } from "@/lib/arabic";

/** قائمة التصريحات بانتظار المراجعة — الأعلى ثقة أولاً ليعتمد المحرر الواضح بسرعة */
export async function listPendingStatements(opts: { limit?: number; offset?: number } = {}) {
  const { limit = 50, offset = 0 } = opts;
  return await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceTitle: statements.sourceTitle,
      confidence: statements.confidence,
      createdAt: statements.createdAt,
      figureId: figures.id,
      figureName: figures.name,
      figureTitle: figures.title,
      figureVerified: figures.verified,
      topicId: topics.id,
      topicName: topics.name,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(eq(statements.status, "pending"))
    .orderBy(sql`${statements.confidence} DESC NULLS LAST`, desc(statements.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function pendingCount(): Promise<number> {
  const [row] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(statements)
    .where(eq(statements.status, "pending"));
  return row?.count ?? 0;
}

/**
 * الاعتماد البشري — المسار الوحيد في الكود الذي يضع status = 'approved'.
 */
export async function approveStatement(id: string, reviewerId: string) {
  const [updated] = await db()
    .update(statements)
    .set({ status: "approved", reviewedBy: reviewerId, reviewedAt: new Date(), rejectionReason: null })
    .where(eq(statements.id, id))
    .returning();
  return updated ?? null;
}

export async function rejectStatement(id: string, reviewerId: string, reason?: string) {
  const [updated] = await db()
    .update(statements)
    .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date(), rejectionReason: reason ?? null })
    .where(eq(statements.id, id))
    .returning();
  return updated ?? null;
}

/** تصحيح الإسناد: تغيير الشخصية و/أو الموضوع لتصريح */
export async function reassignStatement(
  id: string,
  changes: { figureId?: string; topicId?: string | null },
) {
  const set: Record<string, unknown> = {};
  if (changes.figureId) set.figureId = changes.figureId;
  if (changes.topicId !== undefined) set.topicId = changes.topicId;
  if (Object.keys(set).length === 0) return null;
  const [updated] = await db().update(statements).set(set).where(eq(statements.id, id)).returning();
  return updated ?? null;
}

export async function setFigureVerified(id: string, verified: boolean) {
  const [updated] = await db()
    .update(figures)
    .set({ verified, updatedAt: new Date() })
    .where(eq(figures.id, id))
    .returning();
  return updated ?? null;
}

export async function listTopics() {
  return await db().select().from(topics).orderBy(topics.name);
}

/** إيجاد موضوع أو إنشاؤه (يستخدمه worker الاستخراج) */
export async function findOrCreateTopic(name: string) {
  const normalized = normalizeArabic(name);
  const [existing] = await db().select().from(topics).where(eq(topics.normalizedName, normalized)).limit(1);
  if (existing) return existing;
  const [created] = await db()
    .insert(topics)
    .values({ name: name.trim(), normalizedName: normalized })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await db().select().from(topics).where(eq(topics.normalizedName, normalized)).limit(1);
  return raced;
}
