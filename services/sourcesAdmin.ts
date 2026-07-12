import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";

export async function listSources() {
  return await db().select().from(sources).orderBy(asc(sources.name));
}

export async function ensureDefaultSources() {
  const existing = await listSources();
  if (existing.length > 0) return existing;
  const [sabq] = await db()
    .insert(sources)
    .values({
      name: "صحيفة سبق",
      slug: "sabq",
      rssUrl: null,
      enabled: true,
      notes: "أرشيف Postgres عبر SABQ_DATABASE_URL (قراءة فقط)",
    })
    .returning();
  return sabq ? [sabq] : [];
}

export async function createSource(input: {
  name: string;
  slug?: string;
  rssUrl?: string | null;
  enabled?: boolean;
  notes?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("الاسم مطلوب");
  const slug =
    input.slug?.trim() ||
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0600-\u06FF-]+/g, "")
      .slice(0, 64) ||
    `source-${Date.now()}`;

  const [created] = await db()
    .insert(sources)
    .values({
      name,
      slug,
      rssUrl: input.rssUrl?.trim() || null,
      enabled: input.enabled ?? true,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return created;
}

export async function updateSource(
  id: string,
  patch: {
    name?: string;
    rssUrl?: string | null;
    enabled?: boolean;
    notes?: string | null;
  },
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.rssUrl !== undefined) set.rssUrl = patch.rssUrl;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  if (patch.notes !== undefined) set.notes = patch.notes;
  const [updated] = await db().update(sources).set(set).where(eq(sources.id, id)).returning();
  return updated ?? null;
}

export async function deleteSource(id: string) {
  const [deleted] = await db().delete(sources).where(eq(sources.id, id)).returning();
  return deleted ?? null;
}

/** يحدّث إحصاءات سبق بعد دفعة استخراج */
export async function bumpSabqSourceStats(extracted: number, articles: number) {
  const [sabq] = await db().select().from(sources).where(eq(sources.slug, "sabq")).limit(1);
  if (!sabq) return;
  await db()
    .update(sources)
    .set({
      lastFetchedAt: new Date(),
      articlesPulled: sabq.articlesPulled + articles,
      statementsExtracted: sabq.statementsExtracted + extracted,
      updatedAt: new Date(),
    })
    .where(eq(sources.id, sabq.id));
}
