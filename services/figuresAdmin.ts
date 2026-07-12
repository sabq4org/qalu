import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements } from "@/db/schema";
import { normalizeArabic, slugifyArabic } from "@/lib/arabic";

const countPending = sql<number>`count(${statements.id}) filter (where ${statements.status} = 'pending')`;
const countApproved = sql<number>`count(${statements.id}) filter (where ${statements.status} = 'approved')`;
const countRejected = sql<number>`count(${statements.id}) filter (where ${statements.status} = 'rejected')`;

export async function listFiguresAdmin(opts: {
  q?: string;
  verified?: boolean | null;
  limit?: number;
  offset?: number;
} = {}) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const filters = [];
  if (opts.verified === true) filters.push(eq(figures.verified, true));
  if (opts.verified === false) filters.push(eq(figures.verified, false));
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    filters.push(or(ilike(figures.name, q), ilike(figures.title, q), ilike(figures.slug, q)));
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db()
    .select({
      id: figures.id,
      name: figures.name,
      title: figures.title,
      slug: figures.slug,
      imageUrl: figures.imageUrl,
      bio: figures.bio,
      verified: figures.verified,
      displayOrder: figures.displayOrder,
      updatedAt: figures.updatedAt,
      pendingCount: countPending,
      approvedCount: countApproved,
      rejectedCount: countRejected,
    })
    .from(figures)
    .leftJoin(statements, eq(statements.figureId, figures.id))
    .where(where)
    .groupBy(figures.id)
    .orderBy(asc(figures.displayOrder), asc(figures.name))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(figures)
    .where(where);

  return { items: rows, total: totalRow?.count ?? 0 };
}

export async function getFigureAdmin(id: string) {
  const [row] = await db().select().from(figures).where(eq(figures.id, id)).limit(1);
  return row ?? null;
}

export async function updateFigure(
  id: string,
  patch: {
    name?: string;
    title?: string | null;
    bio?: string | null;
    displayOrder?: number;
    verified?: boolean;
  },
) {
  const current = await getFigureAdmin(id);
  if (!current) return null;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.bio !== undefined) set.bio = patch.bio;
  if (patch.displayOrder !== undefined) set.displayOrder = patch.displayOrder;
  if (patch.verified !== undefined) set.verified = patch.verified;

  if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== current.name) {
    const name = patch.name.trim();
    set.name = name;
    set.normalizedName = normalizeArabic(name);
    let slug = slugifyArabic(name);
    for (let attempt = 0; ; attempt++) {
      const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
      const [taken] = await db()
        .select({ id: figures.id })
        .from(figures)
        .where(eq(figures.slug, candidate))
        .limit(1);
      if (!taken || taken.id === id) {
        slug = candidate;
        break;
      }
    }
    set.slug = slug;
  }

  const [updated] = await db().update(figures).set(set).where(eq(figures.id, id)).returning();
  return updated ?? null;
}

export async function mergeFigures(keepId: string, dropId: string) {
  if (keepId === dropId) throw new Error("لا يمكن دمج الشخصية مع نفسها");
  const keep = await getFigureAdmin(keepId);
  const drop = await getFigureAdmin(dropId);
  if (!keep || !drop) return null;

  await db()
    .update(statements)
    .set({ figureId: keepId })
    .where(eq(statements.figureId, dropId));
  await db().delete(figures).where(eq(figures.id, dropId));
  return keep;
}

export async function deleteFigure(id: string) {
  const [deleted] = await db().delete(figures).where(eq(figures.id, id)).returning();
  return deleted ?? null;
}

export async function createFigure(input: {
  name: string;
  title?: string | null;
  bio?: string | null;
  verified?: boolean;
  displayOrder?: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("الاسم مطلوب");
  const normalizedName = normalizeArabic(name);
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
    .values({
      name,
      normalizedName,
      slug,
      title: input.title ?? null,
      bio: input.bio ?? null,
      verified: input.verified ?? false,
      displayOrder: input.displayOrder ?? 1000,
    })
    .returning();
  return created;
}
