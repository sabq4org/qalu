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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_statements_dedupe_hash").on(t.dedupeHash),
    index("idx_statements_figure_status").on(t.figureId, t.status),
    index("idx_statements_figure_status_date").on(t.figureId, t.status, t.statementDate),
    index("idx_statements_status_created").on(t.status, t.createdAt),
    index("idx_statements_source_article").on(t.sourceArticleId),
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
