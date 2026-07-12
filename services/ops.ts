import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { extractionRuns, figures, statements } from "@/db/schema";
import { listSettings, setSetting } from "@/services/settings";

export async function listExtractionRuns(limit = 20) {
  return await db()
    .select()
    .from(extractionRuns)
    .orderBy(desc(extractionRuns.startedAt))
    .limit(limit);
}

export async function getExtractionSettings() {
  const rows = await listSettings("extraction.");
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map["extraction.enabled"] !== "0" && map["extraction.enabled"] !== "false",
    batchSize: Number(map["extraction.batchSize"] ?? 50) || 50,
    saudiGulfOnly:
      map["extraction.saudiGulfOnly"] === "1" || map["extraction.saudiGulfOnly"] === "true",
    runOnce: map["extraction.runOnce"] === "1" || map["extraction.runOnce"] === "true",
  };
}

export async function updateExtractionSettings(input: {
  enabled?: boolean;
  batchSize?: number;
  saudiGulfOnly?: boolean;
  runOnce?: boolean;
}) {
  if (input.enabled !== undefined) {
    await setSetting("extraction.enabled", input.enabled ? "1" : "0");
  }
  if (input.batchSize !== undefined) {
    await setSetting("extraction.batchSize", String(Math.max(1, Math.min(input.batchSize, 200))));
  }
  if (input.saudiGulfOnly !== undefined) {
    await setSetting("extraction.saudiGulfOnly", input.saudiGulfOnly ? "1" : "0");
  }
  if (input.runOnce !== undefined) {
    await setSetting("extraction.runOnce", input.runOnce ? "1" : "0");
  }
  return getExtractionSettings();
}

export async function requestRunOnce() {
  await setSetting("extraction.runOnce", "1");
}

export async function getDashboardOverview() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [[pending], [approved7d], [noImage], [noBio], [lastRun], settings] = await Promise.all([
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(statements)
      .where(eq(statements.status, "pending")),
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(statements)
      .where(and(eq(statements.status, "approved"), gte(statements.reviewedAt, since))),
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(figures)
      .where(sql`${figures.imageUrl} IS NULL OR ${figures.imageUrl} = ''`),
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(figures)
      .where(sql`${figures.bio} IS NULL OR ${figures.bio} = ''`),
    db()
      .select()
      .from(extractionRuns)
      .orderBy(desc(extractionRuns.startedAt))
      .limit(1),
    getExtractionSettings(),
  ]);

  return {
    pendingCount: pending?.count ?? 0,
    approvedLast7Days: approved7d?.count ?? 0,
    figuresWithoutImage: noImage?.count ?? 0,
    figuresWithoutBio: noBio?.count ?? 0,
    lastExtractionRun: lastRun ?? null,
    extraction: settings,
  };
}
