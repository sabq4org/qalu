import OpenAI from "openai";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contradictionPairs,
  figures,
  statements,
  topics,
  weeklyDigests,
} from "@/db/schema";

function startOfWeek(d = new Date()): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - day);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(weekStart: Date): Date {
  const x = new Date(weekStart);
  x.setUTCDate(x.getUTCDate() + 7);
  return x;
}

/** يبني نشرة مساءلة للأسبوع الجاري أو المحدد */
export async function buildWeeklyDigest(weekStartInput?: Date) {
  const weekStart = weekStartInput ?? startOfWeek();
  const weekEnd = endOfWeek(weekStart);

  const highlights = await db()
    .select({
      id: statements.id,
      text: statements.text,
      statementDate: statements.statementDate,
      sourceUrl: statements.sourceUrl,
      statementKind: statements.statementKind,
      figureName: figures.name,
      figureSlug: figures.slug,
      topicName: topics.name,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .leftJoin(topics, eq(statements.topicId, topics.id))
    .where(
      and(
        eq(statements.status, "approved"),
        gte(statements.reviewedAt, weekStart),
        lte(statements.reviewedAt, weekEnd),
      ),
    )
    .orderBy(desc(statements.reviewedAt))
    .limit(12);

  const top =
    highlights.length >= 3
      ? highlights.slice(0, 5)
      : await db()
          .select({
            id: statements.id,
            text: statements.text,
            statementDate: statements.statementDate,
            sourceUrl: statements.sourceUrl,
            statementKind: statements.statementKind,
            figureName: figures.name,
            figureSlug: figures.slug,
            topicName: topics.name,
          })
          .from(statements)
          .innerJoin(figures, eq(statements.figureId, figures.id))
          .leftJoin(topics, eq(statements.topicId, topics.id))
          .where(eq(statements.status, "approved"))
          .orderBy(desc(statements.statementDate))
          .limit(5);

  const openPromises = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(statements)
    .where(
      and(
        eq(statements.status, "approved"),
        eq(statements.statementKind, "promise"),
        eq(statements.promiseStatus, "open"),
      ),
    );

  const contradictions = await db()
    .select({
      id: contradictionPairs.id,
      explanation: contradictionPairs.explanation,
      similarity: contradictionPairs.similarity,
    })
    .from(contradictionPairs)
    .where(eq(contradictionPairs.status, "candidate"))
    .orderBy(desc(contradictionPairs.createdAt))
    .limit(5);

  const weekLabel = new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(weekStart);

  let summary = `أبرز ${top.length} تصريحات موثّقة، مع ${openPromises[0]?.count ?? 0} وعداً مفتوحاً و${contradictions.length} مرشّح تناقض.`;

  if (process.env.OPENAI_API_KEY && top.length > 0) {
    try {
      const openai = new OpenAI();
      const res = await openai.chat.completions.create({
        model: process.env.SEARCH_INTERPRET_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content:
              "اكتب فقرة مساءلة أسبوعية بالعربية الفصحى المبسّطة (٣–٥ جمل) من التصريحات فقط. لا تختلق. نبرة رصينة بلا تهويل.",
          },
          {
            role: "user",
            content: top.map((t, i) => `${i + 1}. ${t.figureName}: «${t.text}»`).join("\n"),
          },
        ],
      });
      summary = res.choices[0]?.message?.content?.trim() || summary;
    } catch (err) {
      console.error("[digest/summary]", err);
    }
  }

  const title = `مساءلة الأسبوع — ${weekLabel}`;
  const payload = JSON.stringify({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    highlights: top,
    openPromisesCount: openPromises[0]?.count ?? 0,
    contradictions,
  });

  const [saved] = await db()
    .insert(weeklyDigests)
    .values({ weekStart, title, summary, payload })
    .onConflictDoUpdate({
      target: weeklyDigests.weekStart,
      set: { title, summary, payload },
    })
    .returning();

  return saved;
}

export async function getLatestDigest() {
  const [row] = await db()
    .select()
    .from(weeklyDigests)
    .orderBy(desc(weeklyDigests.weekStart))
    .limit(1);
  return row ?? null;
}

export async function listDigests(limit = 12) {
  return db().select().from(weeklyDigests).orderBy(desc(weeklyDigests.weekStart)).limit(limit);
}
