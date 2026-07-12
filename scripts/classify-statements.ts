/**
 * تصنيف كل التصريحات المعتمدة (رادار الوعود).
 * npm run classify:statements
 */
import { eq } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env */
  }
}

import { db } from "../db";
import { statements } from "../db/schema";
import { classifyStatement } from "../services/intelligence";

async function main() {
  const rows = await db()
    .select({ id: statements.id })
    .from(statements)
    .where(eq(statements.status, "approved"));
  console.log(`[classify] ${rows.length}`);
  let ok = 0;
  for (const r of rows) {
    const done = await classifyStatement(r.id);
    if (done) ok++;
    process.stdout.write(`\r  ${ok}/${rows.length}`);
  }
  console.log(`\n[classify] تم ${ok}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
