import postgres from "postgres";

/**
 * اتصال قراءة-فقط بقاعدة سبق (أرشيف المقالات).
 * يُستخدم من worker الاستخراج حصراً — ممنوع استيراده من أي صفحة أو API route.
 * SABQ_DATABASE_URL يجب أن يكون لمستخدم Postgres صلاحيته SELECT على articles فقط.
 */
let _sabq: ReturnType<typeof postgres> | null = null;

export function sabqSql() {
  if (!_sabq) {
    const url = process.env.SABQ_DATABASE_URL;
    if (!url) throw new Error("SABQ_DATABASE_URL غير مضبوط");
    _sabq = postgres(url, { prepare: false, max: 2 });
  }
  return _sabq;
}

export interface SabqArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  created_at: Date;
}

/**
 * جلب دفعة مقالات منشورة بعد المؤشر، بترتيب ثابت (created_at, id).
 * ملاحظة: جدول articles في سبق ليس فيه published_at — النشر يعرف بـ status.
 */
export async function fetchArticleBatch(opts: {
  cursorCreatedAt: Date | null;
  cursorArticleId: string | null;
  sinceDays: number;
  limit: number;
}): Promise<SabqArticle[]> {
  const sql = sabqSql();
  const { cursorCreatedAt, cursorArticleId, sinceDays, limit } = opts;

  if (cursorCreatedAt && cursorArticleId) {
    return await sql<SabqArticle[]>`
      SELECT id, title, slug, content, created_at
      FROM articles
      WHERE status = 'published'
        AND article_type = 'news'
        AND length(content) > 400
        AND (created_at, id) > (${cursorCreatedAt}, ${cursorArticleId})
      ORDER BY created_at ASC, id ASC
      LIMIT ${limit}
    `;
  }

  return await sql<SabqArticle[]>`
    SELECT id, title, slug, content, created_at
    FROM articles
    WHERE status = 'published'
      AND article_type = 'news'
      AND length(content) > 400
      AND created_at >= now() - make_interval(days => ${sinceDays})
    ORDER BY created_at ASC, id ASC
    LIMIT ${limit}
  `;
}
