import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

/**
 * اتصال قاعدة بيانات qalu (قراءة/كتابة).
 * تهيئة كسولة حتى لا يفشل build الصفحات الثابتة عند غياب DATABASE_URL.
 */
export function db(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL غير مضبوط");
    // prepare: false للتوافق مع pgbouncer/Neon pooler
    _db = drizzle(postgres(url, { prepare: false, max: 10 }), { schema });
  }
  return _db;
}

export { schema };
