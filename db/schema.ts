import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ── المستخدمون (طاقم المراجعة فقط — لا تسجيل عام) ──────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("reviewer"), // admin | editor | reviewer
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;

// ── الشخصيات ─────────────────────────────────────────────────────
export const figures = pgTable(
  "figures",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    title: text("title"), // الصفة: وزير المالية، مدرب المنتخب...
    slug: text("slug").notNull().unique(),
    imageUrl: text("image_url"),
    bio: text("bio"),
    verified: boolean("verified").notNull().default(false),
    // ترتيب العرض البروتوكولي: الأصغر أولاً (الملك = 1، ولي العهد = 2...)، الافتراضي 1000
    displayOrder: integer("display_order").notNull().default(1000),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_figures_normalized_name").on(t.normalizedName)],
);

export type Figure = typeof figures.$inferSelect;

// ── المواضيع / القضايا ────────────────────────────────────────────
export const topics = pgTable(
  "topics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("idx_topics_normalized_name").on(t.normalizedName)],
);

export type Topic = typeof topics.$inferSelect;

// ── التصريحات ────────────────────────────────────────────────────
// text يُخزن حرفياً كما ورد في المقال — لا يُعاد صياغته أبداً.
// sourceArticleId و sourceUrl إلزاميان: تصريح بلا مصدر يرفضه الـ DB.
export const statements = pgTable(
  "statements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    figureId: varchar("figure_id")
      .references(() => figures.id, { onDelete: "cascade" })
      .notNull(),
    topicId: varchar("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    context: text("context"),
    aiSummary: text("ai_summary"),
    statementDate: timestamp("statement_date").notNull(),
    sourceArticleId: text("source_article_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: text("source_title"),
    sourceName: text("source_name").notNull().default("صحيفة سبق"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    confidence: real("confidence"),
    dedupeHash: text("dedupe_hash").notNull(),
    extractionModel: text("extraction_model"),
    reviewedBy: varchar("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    /** رادار الوعود: promise | stance | denial | figure | general */
    statementKind: text("statement_kind").default("general"),
    /** للوعود: open | fulfilled | broken | unclear */
    promiseStatus: text("promise_status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_statements_dedupe_hash").on(t.dedupeHash),
    index("idx_statements_figure_status").on(t.figureId, t.status),
    index("idx_statements_figure_status_date").on(t.figureId, t.status, t.statementDate),
    index("idx_statements_status_created").on(t.status, t.createdAt),
    index("idx_statements_source_article").on(t.sourceArticleId),
    index("idx_statements_kind").on(t.statementKind),
  ],
);

export type Statement = typeof statements.$inferSelect;

// ── سجل دفعات الاستخراج (المؤشر + الإحصاءات) ─────────────────────
export const extractionRuns = pgTable(
  "extraction_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    cursorCreatedAt: timestamp("cursor_created_at"),
    cursorArticleId: text("cursor_article_id"),
    articlesScanned: integer("articles_scanned").notNull().default(0),
    extracted: integer("extracted").notNull().default(0),
    rejectedVerbatim: integer("rejected_verbatim").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    /** تقدير تقريبي لتكلفة OpenAI بالدولار لهذه الدفعة */
    estimatedCostUsd: real("estimated_cost_usd"),
    notes: text("notes"),
  },
  (t) => [index("idx_extraction_runs_started").on(t.startedAt)],
);

export type ExtractionRun = typeof extractionRuns.$inferSelect;

// ── مصادر الاستخراج (RSS / أرشيف) ─────────────────────────────────
export const sources = pgTable(
  "sources",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    rssUrl: text("rss_url"),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at"),
    articlesPulled: integer("articles_pulled").notNull().default(0),
    statementsExtracted: integer("statements_extracted").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_sources_enabled").on(t.enabled)],
);

export type Source = typeof sources.$inferSelect;

// ── إعدادات التشغيل (key/value) ───────────────────────────────────
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;

// ── سجل التدقيق ───────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    meta: text("meta"), // JSON نصي اختياري
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_audit_logs_created").on(t.createdAt)],
);

export type AuditLog = typeof auditLogs.$inferSelect;

// ── تضمينات البحث الدلالي (JSON لمتجه text-embedding-3-small) ─────
export const statementEmbeddings = pgTable("statement_embeddings", {
  statementId: varchar("statement_id")
    .primaryKey()
    .references(() => statements.id, { onDelete: "cascade" }),
  /** مصفوفة أرقام JSON — بدون اعتماد على امتداد pgvector */
  embedding: text("embedding").notNull(),
  model: text("model").notNull().default("text-embedding-3-small"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StatementEmbedding = typeof statementEmbeddings.$inferSelect;

// ── أزواج تناقض مرشّحة/مؤكدة ─────────────────────────────────────
export const contradictionPairs = pgTable(
  "contradiction_pairs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    statementAId: varchar("statement_a_id")
      .references(() => statements.id, { onDelete: "cascade" })
      .notNull(),
    statementBId: varchar("statement_b_id")
      .references(() => statements.id, { onDelete: "cascade" })
      .notNull(),
    figureId: varchar("figure_id")
      .references(() => figures.id, { onDelete: "cascade" })
      .notNull(),
    similarity: real("similarity"),
    explanation: text("explanation"),
    status: text("status").notNull().default("candidate"), // candidate | confirmed | dismissed
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_contradiction_pair_unique").on(t.statementAId, t.statementBId),
    index("idx_contradiction_figure").on(t.figureId),
  ],
);

export type ContradictionPair = typeof contradictionPairs.$inferSelect;

// ── نشرة المساءلة الأسبوعية ───────────────────────────────────────
export const weeklyDigests = pgTable(
  "weekly_digests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    weekStart: timestamp("week_start").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    payload: text("payload").notNull(), // JSON: highlights, contradictions, promises
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("idx_weekly_digests_week").on(t.weekStart)],
);

export type WeeklyDigest = typeof weeklyDigests.$inferSelect;

// ── مفاتيح API للـ B2B ────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export type ApiKey = typeof apiKeys.$inferSelect;

// ── فحوصات الشاهد (تفريغ ↔ تصريح) ─────────────────────────────────
export const witnessChecks = pgTable(
  "witness_checks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    statementId: varchar("statement_id")
      .references(() => statements.id, { onDelete: "cascade" })
      .notNull(),
    transcript: text("transcript").notNull(),
    mediaUrl: text("media_url"),
    matchScore: real("match_score"),
    verdict: text("verdict").notNull(), // match | partial | mismatch
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_witness_statement").on(t.statementId)],
);

export type WitnessCheck = typeof witnessChecks.$inferSelect;
