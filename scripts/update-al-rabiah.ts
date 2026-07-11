/**
 * تحديث نبذة د. توفيق بن فوزان الربيعة.
 * التشغيل: npx tsx scripts/update-al-rabiah.ts
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* env مصدَّر */
  }
}

const BIO =
  "د. توفيق بن فوزان الربيعة هو وزير الحج والعمرة السعودي الحالي منذ أكتوبر 2021، وقاد سابقاً وزارتي الصحة والتجارة. يحمل شهادة الدكتوراه في علوم الحاسب، ويرأس حالياً الهيئة العامة للعناية بشؤون المسجد الحرام والمسجد النبوي";

async function main() {
  const { eq, ilike, or } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { figures } = await import("../db/schema");

  const rows = await db()
    .select()
    .from(figures)
    .where(
      or(
        ilike(figures.name, "%ربيعة%"),
        ilike(figures.slug, "%ربيعة%"),
        ilike(figures.name, "%rabiah%"),
        ilike(figures.name, "%الربيعه%"),
      ),
    );

  console.log(
    "matches:",
    rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, title: r.title, imageUrl: r.imageUrl })),
  );

  if (rows.length === 0) {
    console.error("لم يُعثر على الشخصية");
    process.exit(1);
  }

  const figure = rows[0];
  const [updated] = await db()
    .update(figures)
    .set({
      bio: BIO,
      imageUrl: "/figures/al-rabiah.jpg",
      title: figure.title || "وزير الحج والعمرة",
      verified: true,
      updatedAt: new Date(),
    })
    .where(eq(figures.id, figure.id))
    .returning();

  console.log("updated:", {
    id: updated.id,
    name: updated.name,
    title: updated.title,
    slug: updated.slug,
    imageUrl: updated.imageUrl,
    bio: updated.bio?.slice(0, 90) + "…",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
