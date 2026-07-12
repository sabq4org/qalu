/**
 * worker استخراج التصريحات من أرشيف سبق.
 *
 * التشغيل المستمر (كل ساعتين):  npm run worker
 * دفعة واحدة للتجربة:            npm run extract:once
 *
 * الخط: مؤشر من extraction_runs → دفعة مقالات من سبق (قراءة فقط) →
 * gpt-4o-mini (استدعاء واحد لكل مقال) → الحارس الحرفي → إدخال pending.
 */
import cron from "node-cron";
import OpenAI from "openai";
import { desc, isNotNull } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* الاعتماد على متغيرات البيئة المصدَّرة */
  }
}

import { db } from "../db";
import { extractionRuns, statements } from "../db/schema";
import { fetchArticleBatch, type SabqArticle } from "../db/sabq";
import { dedupeHash, quoteAppearsInContent, stripHtml } from "../lib/arabic";
import { findOrCreateFigure } from "../services/figures";
import { findOrCreateTopic } from "../services/review";
import { buildUserPrompt, EXTRACTION_MODEL, extractionSchema, SYSTEM_PROMPT } from "./prompt";

const LOG = "[qalu-extraction]";
const BATCH_SIZE = Number(process.env.EXTRACT_BATCH_SIZE ?? 50);
const SINCE_DAYS = Number(process.env.EXTRACT_SINCE_DAYS ?? 90);
const SABQ_ARTICLE_BASE = process.env.SABQ_ARTICLE_BASE ?? "https://sabq.org/article";
// حماية التكلفة: لا نرسل للنموذج أكثر من هذا الحجم من متن المقال
const MAX_CONTENT_CHARS = 12_000;

const openai = new OpenAI();

interface RunStats {
  articlesScanned: number;
  extracted: number;
  rejectedVerbatim: number;
  duplicates: number;
  failures: number;
}

async function getCursor(): Promise<{ createdAt: Date | null; articleId: string | null }> {
  const [last] = await db()
    .select({
      cursorCreatedAt: extractionRuns.cursorCreatedAt,
      cursorArticleId: extractionRuns.cursorArticleId,
    })
    .from(extractionRuns)
    .where(isNotNull(extractionRuns.cursorArticleId))
    .orderBy(desc(extractionRuns.startedAt))
    .limit(1);
  return {
    createdAt: last?.cursorCreatedAt ?? null,
    articleId: last?.cursorArticleId ?? null,
  };
}

async function processArticle(
  article: SabqArticle,
  stats: RunStats,
  opts: { saudiGulfOnly?: boolean } = {},
): Promise<void> {
  const plainContent = stripHtml(article.content).slice(0, MAX_CONTENT_CHARS);

  const scopeHint = opts.saudiGulfOnly
    ? "\n\nقيّد الاستخراج على شخصيات سعودية أو خليجية فقط (مسؤولون/قادة/متحدثون من دول الخليج). تجاهل غيرهم."
    : "";

  const response = await openai.chat.completions.create({
    model: EXTRACTION_MODEL,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(article.title, plainContent) + scopeHint },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsed;
  try {
    parsed = extractionSchema.parse(JSON.parse(raw));
  } catch {
    stats.failures++;
    console.warn(`${LOG} رد غير صالح للمقال ${article.id} — تجاوز`);
    return;
  }

  for (const item of parsed.statements) {
    // الحارس الحرفي: النص يجب أن يوجد فعلاً في متن المقال، وإلا فهو هلوسة
    if (!quoteAppearsInContent(item.quote, article.content)) {
      stats.rejectedVerbatim++;
      continue;
    }

    const figure = await findOrCreateFigure(item.figure_name, item.figure_title ?? null);
    const topic = await findOrCreateTopic(item.topic);
    const hash = dedupeHash(item.quote, figure.normalizedName);

    const inserted = await db()
      .insert(statements)
      .values({
        figureId: figure.id,
        topicId: topic?.id ?? null,
        text: item.quote,
        aiSummary: item.summary ?? null,
        statementDate: article.created_at,
        sourceArticleId: article.id,
        sourceUrl: `${SABQ_ARTICLE_BASE}/${article.slug}`,
        sourceTitle: article.title,
        sourceName: "صحيفة سبق",
        status: "pending",
        confidence: item.confidence,
        dedupeHash: hash,
        extractionModel: EXTRACTION_MODEL,
      })
      .onConflictDoNothing({ target: statements.dedupeHash })
      .returning({ id: statements.id });

    if (inserted.length > 0) stats.extracted++;
    else stats.duplicates++;
  }
}

export async function runExtractionBatch(): Promise<void> {
  const { getSetting, getSettingBool, setSetting } = await import("../services/settings");

  const runOnce = await getSettingBool("extraction.runOnce", false);
  const enabled = await getSettingBool("extraction.enabled", true);
  if (!enabled && !runOnce) {
    console.log(`${LOG} الاستخراج معطّل (extraction.enabled=0) — تخطّي`);
    return;
  }
  if (runOnce) {
    await setSetting("extraction.runOnce", "0");
    console.log(`${LOG} دفعة طارئة (runOnce)`);
  }

  const batchFromSettings = Number(await getSetting("extraction.batchSize", String(BATCH_SIZE)));
  const limit = Number.isFinite(batchFromSettings) && batchFromSettings > 0
    ? Math.min(batchFromSettings, 200)
    : BATCH_SIZE;
  const saudiGulfOnly = await getSettingBool("extraction.saudiGulfOnly", false);

  const cursor = await getCursor();
  console.log(
    `${LOG} بدء دفعة — المؤشر: ${cursor.createdAt?.toISOString() ?? `آخر ${SINCE_DAYS} يوماً`} · حجم=${limit}` +
      (saudiGulfOnly ? " · سعودي/خليجي فقط" : ""),
  );

  const articles = await fetchArticleBatch({
    cursorCreatedAt: cursor.createdAt,
    cursorArticleId: cursor.articleId,
    sinceDays: SINCE_DAYS,
    limit,
  });

  if (articles.length === 0) {
    console.log(`${LOG} لا مقالات جديدة بعد المؤشر`);
    return;
  }

  const stats: RunStats = {
    articlesScanned: 0,
    extracted: 0,
    rejectedVerbatim: 0,
    duplicates: 0,
    failures: 0,
  };

  for (const article of articles) {
    stats.articlesScanned++;
    try {
      await processArticle(article, stats, { saudiGulfOnly });
    } catch (err) {
      // مقال معطوب لا يوقف الدفعة ولا يجمّد المؤشر
      stats.failures++;
      console.error(`${LOG} فشل مقال ${article.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // المؤشر يتقدم دائماً إلى آخر مقال في الدفعة حتى مع وجود إخفاقات جزئية
  const lastArticle = articles[articles.length - 1];
  await db().insert(extractionRuns).values({
    finishedAt: new Date(),
    cursorCreatedAt: lastArticle.created_at,
    cursorArticleId: lastArticle.id,
    articlesScanned: stats.articlesScanned,
    extracted: stats.extracted,
    rejectedVerbatim: stats.rejectedVerbatim,
    duplicates: stats.duplicates,
    failures: stats.failures,
    // تقدير: ~2.5k tokens إدخال + 500 إخراج لكل مقال × أسعار gpt-4o-mini التقريبية
    estimatedCostUsd:
      Math.round(
        (stats.articlesScanned * (2500 * 0.15 + 500 * 0.6)) / 1_000_000 * 10000,
      ) / 10000,
    notes: saudiGulfOnly ? "saudiGulfOnly" : null,
  });

  try {
    const { bumpSabqSourceStats } = await import("../services/sourcesAdmin");
    await bumpSabqSourceStats(stats.extracted, stats.articlesScanned);
  } catch (err) {
    console.warn(`${LOG} تعذر تحديث إحصاءات المصادر:`, err instanceof Error ? err.message : err);
  }

  console.log(
    `${LOG} انتهت الدفعة: ${stats.articlesScanned} مقالاً، ${stats.extracted} تصريحاً جديداً، ` +
      `${stats.rejectedVerbatim} مرفوضاً حرفياً، ${stats.duplicates} مكرراً، ${stats.failures} فشلاً`,
  );
}

async function main() {
  const once = process.argv.includes("--once");
  if (once) {
    await runExtractionBatch();
    process.exit(0);
  }

  console.log(`${LOG} worker يعمل — جدولة كل ساعتين (Asia/Riyadh)`);
  cron.schedule("0 */2 * * *", () => void safeRun(), { timezone: "Asia/Riyadh" });
  // دفعة أولى عند الإقلاع
  await safeRun();
}

async function safeRun() {
  try {
    await runExtractionBatch();
  } catch (err) {
    console.error(`${LOG} فشل الدفعة كاملة:`, err);
  }
}

main().catch((err) => {
  console.error(`${LOG} خطأ قاتل:`, err);
  process.exit(1);
});
