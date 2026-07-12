import OpenAI from "openai";
import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { figures, statementEmbeddings, statements, topics } from "@/db/schema";
import {
  cosineSimilarity,
  createEmbedding,
  parseEmbedding,
} from "@/services/embeddings";

const interpretSchema = z.object({
  keywords: z.array(z.string()).default([]),
  figureHints: z.array(z.string()).default([]),
  topicHints: z.array(z.string()).default([]),
  yearFrom: z.number().nullable().optional(),
  yearTo: z.number().nullable().optional(),
  rewrittenQuery: z.string().optional(),
  intent: z.enum(["quote", "figure", "topic", "general"]).default("general"),
});

export type SearchInterpretation = z.infer<typeof interpretSchema>;

export type SearchHit = {
  id: string;
  text: string;
  context: string | null;
  statementDate: Date;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceName: string;
  figureId: string;
  figureName: string;
  figureTitle: string | null;
  figureSlug: string;
  topicName: string | null;
  score: number;
  matchType: "semantic" | "keyword" | "hybrid";
};

let _openai: OpenAI | null = null;
function openai() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

/**
 * يفسّر استعلاماً طبيعياً بالعربية إلى كلمات مفتاحية وفلاتر.
 * مثال: «ماذا قال الجدعان عن الميزانية 2024؟»
 */
export async function interpretSearchQuery(query: string): Promise<SearchInterpretation> {
  const q = query.trim();
  if (!q) {
    return { keywords: [], figureHints: [], topicHints: [], intent: "general" };
  }

  // بدون مفتاح OpenAI: تقسيم بسيط
  if (!process.env.OPENAI_API_KEY) {
    return {
      keywords: q.split(/\s+/).filter((w) => w.length > 1).slice(0, 8),
      figureHints: [],
      topicHints: [],
      rewrittenQuery: q,
      intent: "general",
    };
  }

  try {
    const res = await openai().chat.completions.create({
      model: process.env.SEARCH_INTERPRET_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `أنت محرك فهم لاستعلامات أرشيف تصريحات عربية «ماذا قالوا؟».
أرجع JSON فقط بالمفاتيح:
keywords (مصفوفة كلمات/عبارات للبحث في نص التصريح),
figureHints (أسماء شخصيات محتملة),
topicHints (مواضيع/قضايا),
yearFrom / yearTo (أرقام سنوات ميلادية أو null),
rewrittenQuery (صيغة بحث محسّنة قصيرة),
intent: quote | figure | topic | general.
لا تخترع أسماء غير مذكورة أو مستنتجة بقوة من الاستعلام.`,
        },
        { role: "user", content: q },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = interpretSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch (err) {
    console.error("[search/interpret]", err);
  }

  return {
    keywords: [q],
    figureHints: [],
    topicHints: [],
    rewrittenQuery: q,
    intent: "general",
  };
}

function yearBounds(from?: number | null, to?: number | null): SQL[] {
  const filters: SQL[] = [];
  if (from && from > 1900 && from < 2100) {
    filters.push(gte(statements.statementDate, new Date(Date.UTC(from, 0, 1))));
  }
  if (to && to > 1900 && to < 2100) {
    filters.push(lte(statements.statementDate, new Date(Date.UTC(to, 11, 31, 23, 59, 59))));
  }
  return filters;
}

async function keywordSearch(
  interp: SearchInterpretation,
  rawQuery: string,
  limit: number,
): Promise<SearchHit[]> {
  const terms = [
    ...interp.keywords,
    ...(interp.rewrittenQuery ? [interp.rewrittenQuery] : []),
    ...interp.figureHints,
    ...interp.topicHints,
    rawQuery,
  ]
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const uniqueTerms = [...new Set(terms)].slice(0, 12);
  const orParts: SQL[] = [];
  for (const term of uniqueTerms) {
    const p = `%${term}%`;
    orParts.push(
      or(
        ilike(statements.text, p),
        ilike(statements.context, p),
        ilike(figures.name, p),
        ilike(figures.title, p),
        ilike(topics.name, p),
        ilike(statements.sourceTitle, p),
      )!,
    );
  }

  const filters: SQL[] = [eq(statements.status, "approved"), ...yearBounds(interp.yearFrom, interp.yearTo)];
  if (orParts.length) filters.push(or(...orParts)!);

  const rows = await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceTitle: statements.sourceTitle,
      sourceName: statements.sourceName,
      figureId: figures.id,
      figureName: figures.name,
      figureTitle: figures.title,
      figureSlug: figures.slug,
      topicName: topics.name,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(and(...filters))
    .orderBy(desc(statements.statementDate))
    .limit(Math.min(limit * 3, 120));

  const qLower = rawQuery.toLowerCase();
  return rows.map((r) => {
    let score = 0.35;
    const blob = `${r.text} ${r.figureName} ${r.topicName ?? ""} ${r.context ?? ""}`.toLowerCase();
    if (blob.includes(qLower)) score += 0.35;
    for (const hint of interp.figureHints) {
      if (r.figureName.includes(hint) || hint.includes(r.figureName.split(" ")[0] ?? "")) score += 0.2;
    }
    for (const hint of interp.topicHints) {
      if ((r.topicName ?? "").includes(hint)) score += 0.15;
    }
    for (const kw of interp.keywords) {
      if (r.text.includes(kw)) score += 0.08;
    }
    return { ...r, score: Math.min(score, 0.95), matchType: "keyword" as const };
  });
}

async function semanticSearch(
  query: string,
  interp: SearchInterpretation,
  limit: number,
): Promise<SearchHit[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const embedText = interp.rewrittenQuery?.trim() || query.trim();
  let queryVec: number[];
  try {
    queryVec = await createEmbedding(embedText);
  } catch (err) {
    console.error("[search/embed-query]", err);
    return [];
  }
  if (queryVec.length === 0) return [];

  const filters: SQL[] = [eq(statements.status, "approved"), ...yearBounds(interp.yearFrom, interp.yearTo)];

  // نجلب دفعة معقولة من التضمينات المعتمدة ثم نرتّب في الذاكرة (الأرشيف صغير)
  const rows = await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      sourceTitle: statements.sourceTitle,
      sourceName: statements.sourceName,
      figureId: figures.id,
      figureName: figures.name,
      figureTitle: figures.title,
      figureSlug: figures.slug,
      topicName: topics.name,
      embedding: statementEmbeddings.embedding,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .innerJoin(statementEmbeddings, eq(statementEmbeddings.statementId, statements.id))
    .where(and(...filters))
    .orderBy(desc(statements.statementDate))
    .limit(800);

  const scored = rows
    .map((r) => {
      const vec = parseEmbedding(r.embedding);
      const sim = cosineSimilarity(queryVec, vec);
      // تعزيز بسيط إن طابق اسم شخصية من التفسير
      let boost = 0;
      for (const hint of interp.figureHints) {
        if (r.figureName.includes(hint) || hint.includes(r.figureName)) boost += 0.05;
      }
      return {
        id: r.id,
        text: r.text,
        context: r.context,
        statementDate: r.statementDate,
        sourceUrl: r.sourceUrl,
        sourceTitle: r.sourceTitle,
        sourceName: r.sourceName,
        figureId: r.figureId,
        figureName: r.figureName,
        figureTitle: r.figureTitle,
        figureSlug: r.figureSlug,
        topicName: r.topicName,
        score: Math.min(sim + boost, 1),
        matchType: "semantic" as const,
      };
    })
    .filter((r) => r.score >= 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

function mergeHits(a: SearchHit[], b: SearchHit[], limit: number): SearchHit[] {
  const map = new Map<string, SearchHit>();
  for (const hit of [...a, ...b]) {
    const prev = map.get(hit.id);
    if (!prev) {
      map.set(hit.id, hit);
      continue;
    }
    const hybridScore = Math.min(1, prev.score * 0.55 + hit.score * 0.55 + 0.08);
    map.set(hit.id, {
      ...prev,
      score: Math.max(prev.score, hit.score, hybridScore),
      matchType: "hybrid",
    });
  }
  return [...map.values()].sort((x, y) => y.score - x.score).slice(0, limit);
}

export async function searchStatements(
  query: string,
  opts: { limit?: number; mode?: "hybrid" | "keyword" | "semantic" } = {},
): Promise<{
  items: SearchHit[];
  interpretation: SearchInterpretation;
  mode: string;
  tookMs: number;
}> {
  const started = Date.now();
  const limit = Math.min(opts.limit ?? 20, 50);
  const mode = opts.mode ?? "hybrid";
  const q = query.trim();
  if (q.length < 2) {
    return {
      items: [],
      interpretation: { keywords: [], figureHints: [], topicHints: [], intent: "general" },
      mode,
      tookMs: Date.now() - started,
    };
  }

  const interpretation = await interpretSearchQuery(q);

  let items: SearchHit[] = [];
  if (mode === "keyword") {
    items = (await keywordSearch(interpretation, q, limit)).slice(0, limit);
  } else if (mode === "semantic") {
    items = await semanticSearch(q, interpretation, limit);
  } else {
    const [kw, sem] = await Promise.all([
      keywordSearch(interpretation, q, limit),
      semanticSearch(q, interpretation, limit),
    ]);
    items = mergeHits(kw, sem, limit);
  }

  return { items, interpretation, mode, tookMs: Date.now() - started };
}

/** اقتراحات سريعة للشخصيات */
export async function suggestFigures(q: string, limit = 6) {
  const pattern = `%${q.trim()}%`;
  if (q.trim().length < 1) return [];
  return db()
    .select({
      id: figures.id,
      name: figures.name,
      title: figures.title,
      slug: figures.slug,
      verified: figures.verified,
    })
    .from(figures)
    .where(or(ilike(figures.name, pattern), ilike(figures.title, pattern)))
    .orderBy(asc(figures.displayOrder), asc(figures.name))
    .limit(limit);
}
