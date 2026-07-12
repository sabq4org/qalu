import OpenAI from "openai";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  contradictionPairs,
  figures,
  statementEmbeddings,
  statements,
  topics,
} from "@/db/schema";
import { cosineSimilarity, parseEmbedding } from "@/services/embeddings";

const kindSchema = z.object({
  kind: z.enum(["promise", "stance", "denial", "figure", "general"]),
  promiseStatus: z.enum(["open", "fulfilled", "broken", "unclear"]).nullable().optional(),
});

let _openai: OpenAI | null = null;
function openai() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

/** تصنيف تصريح لرادار الوعود */
export async function classifyStatement(statementId: string): Promise<boolean> {
  const [row] = await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      status: statements.status,
    })
    .from(statements)
    .where(eq(statements.id, statementId))
    .limit(1);
  if (!row || row.status !== "approved") return false;
  if (!process.env.OPENAI_API_KEY) {
    await db()
      .update(statements)
      .set({ statementKind: "general" })
      .where(eq(statements.id, statementId));
    return true;
  }

  try {
    const res = await openai().chat.completions.create({
      model: process.env.SEARCH_INTERPRET_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `صنّف تصريحاً عربياً حرفياً. أرجع JSON:
kind: promise (وعد/تعهّد مستقبلي) | stance (موقف) | denial (نفي) | figure (رقم/إحصاء) | general
promiseStatus: إن كان promise فقط → open (افتراضي) وإلا null
كن متحفظاً: لا تعتبر كل جملة وعداً.`,
        },
        {
          role: "user",
          content: `${row.text}${row.context ? `\nسياق: ${row.context}` : ""}`,
        },
      ],
    });
    const parsed = kindSchema.safeParse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
    if (!parsed.success) return false;
    const kind = parsed.data.kind;
    await db()
      .update(statements)
      .set({
        statementKind: kind,
        promiseStatus: kind === "promise" ? parsed.data.promiseStatus ?? "open" : null,
      })
      .where(eq(statements.id, statementId));
    return true;
  } catch (err) {
    console.error("[classify]", err);
    return false;
  }
}

export function classifyInBackground(statementId: string) {
  void classifyStatement(statementId).catch((err) =>
    console.error("[classify/bg]", err instanceof Error ? err.message : err),
  );
}

const contradictSchema = z.object({
  isContradiction: z.boolean(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * يبحث عن تصريحات لنفس الشخصية قد تناقض التصريح الحالي (تشابه دلالي + حكم AI).
 */
export async function findContradictions(statementId: string, limit = 5) {
  const [anchor] = await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      figureId: figures.id,
      figureName: figures.name,
      figureSlug: figures.slug,
      topicName: topics.name,
      embedding: statementEmbeddings.embedding,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .leftJoin(statementEmbeddings, eq(statementEmbeddings.statementId, statements.id))
    .where(and(eq(statements.id, statementId), eq(statements.status, "approved")))
    .limit(1);

  if (!anchor) return { anchor: null, candidates: [] as const };

  const others = await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      topicName: topics.name,
      embedding: statementEmbeddings.embedding,
    })
    .from(statements)
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .leftJoin(statementEmbeddings, eq(statementEmbeddings.statementId, statements.id))
    .where(
      and(
        eq(statements.figureId, anchor.figureId),
        eq(statements.status, "approved"),
        ne(statements.id, statementId),
      ),
    )
    .orderBy(desc(statements.statementDate))
    .limit(80);

  const anchorVec = anchor.embedding ? parseEmbedding(anchor.embedding) : [];
  const ranked = others
    .map((o) => {
      const vec = o.embedding ? parseEmbedding(o.embedding) : [];
      const sim = anchorVec.length && vec.length ? cosineSimilarity(anchorVec, vec) : 0;
      return { ...o, similarity: sim };
    })
    .filter((o) => o.similarity >= 0.42)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);

  const candidates: Array<{
    id: string;
    text: string;
    context: string | null;
    statementDate: Date;
    sourceUrl: string;
    topicName: string | null;
    similarity: number;
    isContradiction: boolean;
    explanation: string;
  }> = [];

  for (const c of ranked) {
    let isContradiction = false;
    let explanation = "تشابه موضوعي — يُراجع يدوياً";
    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await openai().chat.completions.create({
          model: process.env.SEARCH_INTERPRET_MODEL ?? "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          max_tokens: 280,
          messages: [
            {
              role: "system",
              content: `هل التصريحان لنفس الشخص يناقض أحدهما الآخر في المعنى الجوهري؟
أرجع JSON: { "isContradiction": boolean, "explanation": string بالعربية موجز ودقيق, "confidence": 0-1 }
التطور في الموقف أو اختلاف السياق الزمني ليس تناقضاً تلقائياً. كن صارماً.`,
            },
            {
              role: "user",
              content: `أ) ${anchor.text}\nب) ${c.text}`,
            },
          ],
        });
        const parsed = contradictSchema.safeParse(
          JSON.parse(res.choices[0]?.message?.content ?? "{}"),
        );
        if (parsed.success) {
          isContradiction = parsed.data.isContradiction;
          explanation = parsed.data.explanation;
        }
      } catch (err) {
        console.error("[contradict/judge]", err);
      }
    }

    if (isContradiction || c.similarity >= 0.62) {
      candidates.push({
        id: c.id,
        text: c.text,
        context: c.context,
        statementDate: c.statementDate,
        sourceUrl: c.sourceUrl,
        topicName: c.topicName,
        similarity: c.similarity,
        isContradiction,
        explanation,
      });

      // احفظ المرشّح
      const [a, b] = [statementId, c.id].sort();
      await db()
        .insert(contradictionPairs)
        .values({
          statementAId: a,
          statementBId: b,
          figureId: anchor.figureId,
          similarity: c.similarity,
          explanation,
          status: isContradiction ? "candidate" : "candidate",
        })
        .onConflictDoNothing();
    }
    if (candidates.length >= limit) break;
  }

  return {
    anchor: {
      id: anchor.id,
      text: anchor.text,
      figureName: anchor.figureName,
      figureSlug: anchor.figureSlug,
      statementDate: anchor.statementDate,
    },
    candidates: candidates.filter((c) => c.isContradiction).slice(0, limit),
  };
}

export async function listOpenPromises(opts: { figureId?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 40;
  const filters = [
    eq(statements.status, "approved"),
    eq(statements.statementKind, "promise"),
    eq(statements.promiseStatus, "open"),
  ];
  if (opts.figureId) filters.push(eq(statements.figureId, opts.figureId));

  const rows = await db()
    .select({
      id: statements.id,
      text: statements.text,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
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

  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    daysOpen: Math.max(
      0,
      Math.floor((now - new Date(r.statementDate).getTime()) / (86400 * 1000)),
    ),
  }));
}

export async function updatePromiseStatus(
  id: string,
  status: "open" | "fulfilled" | "broken" | "unclear",
) {
  const [updated] = await db()
    .update(statements)
    .set({ promiseStatus: status })
    .where(and(eq(statements.id, id), eq(statements.statementKind, "promise")))
    .returning();
  return updated ?? null;
}
