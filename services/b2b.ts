import { createHash, randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, figures, statements, topics } from "@/db/schema";

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createApiKey(name: string, webhookUrl?: string | null) {
  const raw = `qalu_${randomBytes(24).toString("hex")}`;
  const keyPrefix = raw.slice(0, 12);
  const [row] = await db()
    .insert(apiKeys)
    .values({
      name: name.trim(),
      keyPrefix,
      keyHash: hashApiKey(raw),
      webhookUrl: webhookUrl?.trim() || null,
    })
    .returning();
  return { key: row, raw };
}

export async function listApiKeys() {
  return db()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      enabled: apiKeys.enabled,
      webhookUrl: apiKeys.webhookUrl,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));
}

export async function verifyApiKey(raw: string | null | undefined) {
  if (!raw?.startsWith("qalu_")) return null;
  const hash = hashApiKey(raw);
  const [row] = await db()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.enabled, true)))
    .limit(1);
  if (!row) return null;
  await db()
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return row;
}

export async function setApiKeyEnabled(id: string, enabled: boolean) {
  const [row] = await db()
    .update(apiKeys)
    .set({ enabled })
    .where(eq(apiKeys.id, id))
    .returning();
  return row ?? null;
}

export async function b2bListStatements(opts: {
  limit?: number;
  figureSlug?: string;
}) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const filters = [eq(statements.status, "approved")];
  if (opts.figureSlug) filters.push(eq(figures.slug, opts.figureSlug));

  return db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceName: statements.sourceName,
      statementKind: statements.statementKind,
      promiseStatus: statements.promiseStatus,
      figureName: figures.name,
      figureSlug: figures.slug,
      figureTitle: figures.title,
      topicName: topics.name,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(and(...filters))
    .orderBy(desc(statements.statementDate))
    .limit(limit);
}
