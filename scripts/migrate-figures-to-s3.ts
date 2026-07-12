/**
 * ترحيل صور public/figures إلى Railway Bucket وتحديث imageUrl في القاعدة.
 * التشغيل (بعد ضبط S3_* في .env.local):
 *   npx tsx scripts/migrate-figures-to-s3.ts
 */
import { readFile, readdir } from "fs/promises";
import path from "path";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env مصدَّر */
  }
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { figures } = await import("../db/schema");
  const { isStorageConfigured, mediaUrl, missingStorageEnvNames, uploadObject } = await import(
    "../services/objectStorage"
  );

  if (!isStorageConfigured()) {
    const missing = missingStorageEnvNames();
    console.error("S3 غير مضبوط — أضف المتغيرات من Railway Bucket إلى .env.local");
    if (missing.length) console.error("ناقص:", missing.join(", "));
    console.error("المطلوب عادة: S3_ACCESS_KEY_ID و S3_SECRET_ACCESS_KEY (بعد ملء Endpoint/Bucket)");
    process.exit(1);
  }

  const dir = path.join(process.cwd(), "public", "figures");
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`ملفات محلية: ${files.length}`);

  for (const file of files) {
    const abs = path.join(dir, file);
    const buf = await readFile(abs);
    const ext = path.extname(file).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const key = `figures/${file}`;
    const url = await uploadObject(key, buf, contentType);
    console.log("uploaded", key, "→", url);

    const oldPublic = `/figures/${file}`;
    const updated = await db()
      .update(figures)
      .set({ imageUrl: mediaUrl(key), updatedAt: new Date() })
      .where(eq(figures.imageUrl, oldPublic))
      .returning({ id: figures.id, name: figures.name, slug: figures.slug });

    if (updated.length === 0) {
      console.log("  (لا صف مرتبط بـ", oldPublic, ")");
    } else {
      for (const row of updated) {
        console.log("  db:", row.name, row.slug);
      }
    }
  }

  console.log("تم.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
