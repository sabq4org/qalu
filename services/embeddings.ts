import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { figures, statementEmbeddings, statements, topics } from "@/db/schema";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

let _openai: OpenAI | null = null;
function openai() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function parseEmbedding(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

/** نص يُضمَّن: الاقتباس + الشخصية + الموضوع + السياق */
export function buildEmbedDocument(input: {
  text: string;
  figureName: string;
  figureTitle?: string | null;
  topicName?: string | null;
  context?: string | null;
}): string {
  return [
    input.text,
    `المتحدث: ${input.figureName}${input.figureTitle ? ` — ${input.figureTitle}` : ""}`,
    input.topicName ? `الموضوع: ${input.topicName}` : null,
    input.context ? `السياق: ${input.context}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createEmbedding(text: string): Promise<number[]> {
  const res = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return res.data[0]?.embedding ?? [];
}

export async function upsertStatementEmbedding(statementId: string): Promise<boolean> {
  const [row] = await db()
    .select({
      text: statements.text,
      context: statements.context,
      status: statements.status,
      figureName: figures.name,
      figureTitle: figures.title,
      topicName: topics.name,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(eq(statements.id, statementId))
    .limit(1);

  if (!row || row.status !== "approved") {
    await db().delete(statementEmbeddings).where(eq(statementEmbeddings.statementId, statementId));
    return false;
  }

  const vec = await createEmbedding(
    buildEmbedDocument({
      text: row.text,
      figureName: row.figureName,
      figureTitle: row.figureTitle,
      topicName: row.topicName,
      context: row.context,
    }),
  );
  if (vec.length === 0) return false;

  await db()
    .insert(statementEmbeddings)
    .values({
      statementId,
      embedding: JSON.stringify(vec),
      model: EMBEDDING_MODEL,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: statementEmbeddings.statementId,
      set: {
        embedding: JSON.stringify(vec),
        model: EMBEDDING_MODEL,
        updatedAt: new Date(),
      },
    });
  return true;
}

/** فهرسة غير حاجزة — لا تُفشل مسار الاعتماد إن فشلت */
export function indexStatementInBackground(statementId: string) {
  void upsertStatementEmbedding(statementId).catch((err) => {
    console.error("[embeddings]", statementId, err instanceof Error ? err.message : err);
  });
}
