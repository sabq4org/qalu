/**
 * فهرسة تضمينات كل التصريحات المعتمدة للبحث الدلالي.
 * التشغيل: npm run index:embeddings
 */
import { eq } from "drizzle-orm";

process.env.QALU_SCRIPT = "1";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env من النظام */
  }
}

import { closeDb, db } from "../db";
import { statements } from "../db/schema";
import { upsertStatementEmbedding } from "../services/embeddings";

async function main() {
  const rows = await db()
    .select({ id: statements.id })
    .from(statements)
    .where(eq(statements.status, "approved"));

  console.log(`[index:embeddings] ${rows.length} تصريحاً معتمداً`);
  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      const done = await upsertStatementEmbedding(row.id);
      if (done) ok++;
      else fail++;
      process.stdout.write(`\r  ${ok + fail}/${rows.length}`);
    } catch (err) {
      fail++;
      console.error(`\nفشل ${row.id}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\n[index:embeddings] تم ${ok} · فشل/تخطّي ${fail}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
