import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _sql: Sql | null = null;

/**
 * اتصال قاعدة بيانات qalu (قراءة/كتابة).
 * تهيئة كسولة حتى لا يفشل build الصفحات الثابتة عند غياب DATABASE_URL.
 */
export function db(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL غير مضبوط");
    // سكربتات CLI: اتصال واحد + مهلة أوضح (Neon/pgbouncer يقطع أحياناً)
    const isScript = process.env.QALU_SCRIPT === "1";
    _sql = postgres(url, {
      prepare: false,
      max: isScript ? 1 : 10,
      idle_timeout: isScript ? 20 : 30,
      connect_timeout: 30,
      max_lifetime: isScript ? 60 * 5 : 60 * 30,
    });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

/** إغلاق صريح لاتصال السكربتات */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
    _db = null;
  }
}

export { schema };
