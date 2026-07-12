import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements, topics } from "@/db/schema";
import { normalizeArabic } from "@/lib/arabic";

export type StatementListStatus = "pending" | "rejected";

export type ListStatementsOpts = {
  limit?: number;
  offset?: number;
  status?: StatementListStatus;
  figureId?: string;
  topicId?: string;
  minConfidence?: number;
  q?: string;
  sourceName?: string;
};

function buildStatementFilters(opts: ListStatementsOpts): SQL | undefined {
  const status = opts.status ?? "pending";
  const filters: SQL[] = [eq(statements.status, status)];
  if (opts.figureId) filters.push(eq(statements.figureId, opts.figureId));
  if (opts.topicId) filters.push(eq(statements.topicId, opts.topicId));
  if (opts.minConfidence != null && !Number.isNaN(opts.minConfidence)) {
    filters.push(gte(statements.confidence, opts.minConfidence));
  }
  if (opts.sourceName?.trim()) {
    filters.push(ilike(statements.sourceName, `%${opts.sourceName.trim()}%`));
  }
  if (opts.q?.trim()) {
    const pattern = `%${opts.q.trim()}%`;
    filters.push(
      or(ilike(statements.text, pattern), ilike(statements.context, pattern), ilike(figures.name, pattern))!,
    );
  }
  return and(...filters);
}

/** قائمة تصريحات للمراجعة — pending أو rejected مع فلاتر */
export async function listPendingStatements(opts: ListStatementsOpts = {}) {
  const { limit = 50, offset = 0 } = opts;
  const where = buildStatementFilters(opts);
  return await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceTitle: statements.sourceTitle,
      sourceName: statements.sourceName,
      confidence: statements.confidence,
      status: statements.status,
      rejectionReason: statements.rejectionReason,
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
    .where(where)
    .orderBy(sql`${statements.confidence} DESC NULLS LAST`, desc(statements.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function pendingCount(opts: Omit<ListStatementsOpts, "limit" | "offset"> = {}): Promise<number> {
  const where = buildStatementFilters({ ...opts, status: opts.status ?? "pending" });
  const [row] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .where(where);
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
  if (updated) {
    const { indexStatementInBackground } = await import("@/services/embeddings");
    const { classifyInBackground } = await import("@/services/intelligence");
    indexStatementInBackground(updated.id);
    classifyInBackground(updated.id);
  }
  return updated ?? null;
}

export async function rejectStatement(id: string, reviewerId: string, reason?: string) {
  const [updated] = await db()
    .update(statements)
    .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date(), rejectionReason: reason ?? null })
    .where(eq(statements.id, id))
    .returning();
  if (updated) {
    const { statementEmbeddings } = await import("@/db/schema");
    await db().delete(statementEmbeddings).where(eq(statementEmbeddings.statementId, id));
  }
  return updated ?? null;
}

/** استرجاع مرفوض → معلّق */
export async function restoreStatement(id: string, reviewerId: string) {
  const [updated] = await db()
    .update(statements)
    .set({
      status: "pending",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(statements.id, id))
    .returning();
  if (updated) {
    const { statementEmbeddings } = await import("@/db/schema");
    await db().delete(statementEmbeddings).where(eq(statementEmbeddings.statementId, id));
  }
  return updated ?? null;
}

/** تصحيح الإسناد / حقول قبل الاعتماد: شخصية، موضوع، سياق */
export async function reassignStatement(
  id: string,
  changes: { figureId?: string; topicId?: string | null; context?: string | null },
) {
  const set: Record<string, unknown> = {};
  if (changes.figureId) set.figureId = changes.figureId;
  if (changes.topicId !== undefined) set.topicId = changes.topicId;
  if (changes.context !== undefined) set.context = changes.context;
  if (Object.keys(set).length === 0) return null;
  const [updated] = await db().update(statements).set(set).where(eq(statements.id, id)).returning();
  return updated ?? null;
}

export async function bulkReview(
  ids: string[],
  action: "approve" | "reject" | "restore",
  reviewerId: string,
  reason?: string,
) {
  const results: string[] = [];
  for (const id of ids) {
    let updated = null;
    if (action === "approve") updated = await approveStatement(id, reviewerId);
    else if (action === "reject") updated = await rejectStatement(id, reviewerId, reason);
    else updated = await restoreStatement(id, reviewerId);
    if (updated) results.push(id);
  }
  return results;
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

export type ManualStatementInput = {
  /** إما شخصية موجودة أو اسم جديد */
  figureId?: string;
  figureName?: string;
  figureTitle?: string | null;
  /** توثيق الشخصية فوراً عند الإنشاء/الإدخال */
  verifyFigure?: boolean;
  text: string;
  context?: string | null;
  statementDate: Date | string;
  topicId?: string | null;
  topicName?: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceTitle?: string | null;
  enteredBy: string;
};

export type ManualStatementResult =
  | { ok: true; statement: typeof statements.$inferSelect; figureSlug: string; duplicate?: false }
  | { ok: false; reason: "duplicate" | "validation"; message: string };

/**
 * إدخال يدوي موثق — يُعتمد فوراً ويسجّل المُدخل في reviewedBy.
 * يقتل الحاجة لسكربتات seed للمحتوى المنتقى.
 */
export async function createManualStatement(
  input: ManualStatementInput,
): Promise<ManualStatementResult> {
  const text = input.text?.trim() ?? "";
  const sourceUrl = input.sourceUrl?.trim() ?? "";
  const sourceName = input.sourceName?.trim() ?? "";
  if (!text || text.length < 10) {
    return { ok: false, reason: "validation", message: "نص التصريح قصير جداً" };
  }
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, reason: "validation", message: "رابط المصدر غير صالح" };
  }
  if (!sourceName) {
    return { ok: false, reason: "validation", message: "اسم المصدر مطلوب" };
  }

  const date =
    input.statementDate instanceof Date
      ? input.statementDate
      : new Date(input.statementDate);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, reason: "validation", message: "تاريخ التصريح غير صالح" };
  }

  let figure =
    input.figureId != null
      ? (
          await db()
            .select()
            .from(figures)
            .where(eq(figures.id, input.figureId))
            .limit(1)
        )[0]
      : null;

  if (!figure) {
    const name = input.figureName?.trim() ?? "";
    if (!name) {
      return { ok: false, reason: "validation", message: "اختر شخصية أو أدخل اسماً جديداً" };
    }
    const { findOrCreateFigure } = await import("@/services/figures");
    figure = await findOrCreateFigure(name, input.figureTitle ?? null);
    if (input.figureTitle?.trim()) {
      await db()
        .update(figures)
        .set({ title: input.figureTitle.trim(), updatedAt: new Date() })
        .where(eq(figures.id, figure.id));
      figure = { ...figure, title: input.figureTitle.trim() };
    }
  }

  if (input.verifyFigure && !figure.verified) {
    const [verified] = await db()
      .update(figures)
      .set({ verified: true, updatedAt: new Date() })
      .where(eq(figures.id, figure.id))
      .returning();
    if (verified) figure = verified;
  }

  let topicId: string | null = input.topicId ?? null;
  if (!topicId && input.topicName?.trim()) {
    const topic = await findOrCreateTopic(input.topicName.trim());
    topicId = topic?.id ?? null;
  }

  const { dedupeHash } = await import("@/lib/arabic");
  const hash = dedupeHash(text, figure.normalizedName);

  const [existing] = await db()
    .select({ id: statements.id })
    .from(statements)
    .where(eq(statements.dedupeHash, hash))
    .limit(1);
  if (existing) {
    return { ok: false, reason: "duplicate", message: "تصريح مطابق موجود مسبقاً" };
  }

  const [created] = await db()
    .insert(statements)
    .values({
      figureId: figure.id,
      topicId,
      text,
      context: input.context?.trim() || null,
      statementDate: date,
      sourceArticleId: "manual-entry",
      sourceUrl,
      sourceTitle: input.sourceTitle?.trim() || null,
      sourceName,
      status: "approved",
      confidence: 1,
      dedupeHash: hash,
      extractionModel: "manual",
      reviewedBy: input.enteredBy,
      reviewedAt: new Date(),
    })
    .returning();

  if (!created) {
    return { ok: false, reason: "validation", message: "تعذر حفظ التصريح" };
  }

  const { indexStatementInBackground } = await import("@/services/embeddings");
  const { classifyInBackground } = await import("@/services/intelligence");
  indexStatementInBackground(created.id);
  classifyInBackground(created.id);

  return { ok: true, statement: created, figureSlug: figure.slug };
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
