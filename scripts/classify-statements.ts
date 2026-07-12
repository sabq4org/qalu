/**
 * تصنيف كل التصريحات المعتمدة (رادار الوعود).
 * npm run classify:statements
 *
 * يعيد المحاولة تلقائياً عند ECONNRESET / انقطاع Neon.
 */
import { eq } from "drizzle-orm";

process.env.QALU_SCRIPT = "1";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env */
  }
}

import { closeDb, db } from "../db";
import { statements } from "../db/schema";
import { classifyStatement } from "../services/intelligence";

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${(err as { cause?: Error }).cause?.message ?? ""}` : String(err);
  const code =
    err && typeof err === "object" && "cause" in err
      ? String((err as { cause?: { code?: string } }).cause?.code ?? "")
      : "";
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    /ECONNRESET|ETIMEDOUT|connection.*closed|CONNECT_TIMEOUT/i.test(msg)
  );
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === attempts) throw err;
      const wait = 500 * i * i;
      console.warn(`\n[classify] ${label} — إعادة محاولة ${i}/${attempts} بعد ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      await closeDb().catch(() => undefined);
    }
  }
  throw last;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL غير مضبوط — ضعّه في .env.local");
    process.exit(1);
  }

  const rows = await withRetry("جلب المعتمد", () =>
    db()
      .select({ id: statements.id })
      .from(statements)
      .where(eq(statements.status, "approved")),
  );

  console.log(`[classify] ${rows.length} تصريحاً معتمداً`);
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    try {
      const done = await withRetry(`تصنيف ${r.id.slice(0, 8)}`, () => classifyStatement(r.id), 3);
      if (done) ok++;
      else fail++;
      // فاصل قصير يقلل ضغط OpenAI وقطع اتصال DB الخامل
      await new Promise((r) => setTimeout(r, 150));
      process.stdout.write(`\r  ${ok + fail}/${rows.length}`);
    } catch (err) {
      fail++;
      console.error(`\nفشل ${r.id}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\n[classify] تم ${ok} · فشل ${fail}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
