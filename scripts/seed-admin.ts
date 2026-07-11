/**
 * إنشاء/تحديث مستخدم الأدمن.
 * الاستخدام: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run seed:admin
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* الاعتماد على متغيرات البيئة المصدَّرة */
  }
}

async function main() {
  const { db } = await import("../db");
  const { users } = await import("../db/schema");

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "المشرف";

  if (!email || !password) {
    console.error("يجب ضبط ADMIN_EMAIL و ADMIN_PASSWORD");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await db().select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db()
      .update(users)
      .set({ passwordHash, name, role: "admin" })
      .where(eq(users.id, existing.id));
    console.log(`تم تحديث الأدمن: ${email}`);
  } else {
    await db().insert(users).values({ email, passwordHash, name, role: "admin" });
    console.log(`تم إنشاء الأدمن: ${email}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
