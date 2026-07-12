import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { statements, topics } from "@/db/schema";
import { normalizeArabic } from "@/lib/arabic";

const stmtCount = sql<number>`count(${statements.id})`;

export async function listTopicsWithCounts(opts: { q?: string; limit?: number; offset?: number } = {}) {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const where = opts.q?.trim()
    ? orIlike(opts.q.trim())
    : undefined;

  const items = await db()
    .select({
      id: topics.id,
      name: topics.name,
      normalizedName: topics.normalizedName,
      createdAt: topics.createdAt,
      statementCount: stmtCount,
    })
    .from(topics)
    .leftJoin(statements, eq(statements.topicId, topics.id))
    .where(where)
    .groupBy(topics.id)
    .orderBy(asc(topics.name))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(topics)
    .where(where);

  return { items, total: totalRow?.count ?? 0 };
}

function orIlike(q: string) {
  const pattern = `%${q}%`;
  return and(ilike(topics.name, pattern));
}

export async function renameTopic(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("الاسم مطلوب");
  const normalizedName = normalizeArabic(trimmed);
  const [taken] = await db()
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.normalizedName, normalizedName))
    .limit(1);
  if (taken && taken.id !== id) throw new Error("موضوع بهذا الاسم موجود مسبقاً");

  const [updated] = await db()
    .update(topics)
    .set({ name: trimmed, normalizedName })
    .where(eq(topics.id, id))
    .returning();
  return updated ?? null;
}

export async function mergeTopics(keepId: string, dropId: string) {
  if (keepId === dropId) throw new Error("لا يمكن دمج الموضوع مع نفسه");
  const [keep] = await db().select().from(topics).where(eq(topics.id, keepId)).limit(1);
  const [drop] = await db().select().from(topics).where(eq(topics.id, dropId)).limit(1);
  if (!keep || !drop) return null;

  await db().update(statements).set({ topicId: keepId }).where(eq(statements.topicId, dropId));
  await db().delete(topics).where(eq(topics.id, dropId));
  return keep;
}

export async function deleteTopic(id: string) {
  const [countRow] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(statements)
    .where(eq(statements.topicId, id));
  if ((countRow?.count ?? 0) > 0) {
    throw new Error("الموضوع مستخدم — ادمجه أولاً أو انقل التصريحات");
  }
  const [deleted] = await db().delete(topics).where(eq(topics.id, id)).returning();
  return deleted ?? null;
}
