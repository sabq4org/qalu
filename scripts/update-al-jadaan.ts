/**
 * تحديث نبذة محمد بن عبدالله الجدعان.
 * التشغيل: npx tsx scripts/update-al-jadaan.ts
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
  "محمد بن عبد الله الجدعان هو وزير المالية السعودي الحالي منذ عام 2016، وشغل سابقاً رئيس هيئة السوق المالية. يحمل خلفية قانونية واقتصادية واسعة، ويشغل عضوية مجلس إدارة صندوق الاستثمارات العامة وشركة أرامكو السعودية.";

async function main() {
  const { eq, ilike, or } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { figures } = await import("../db/schema");

  const rows = await db()
    .select()
    .from(figures)
    .where(or(ilike(figures.name, "%جدعان%"), ilike(figures.slug, "%جدعان%")));

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
      imageUrl: "/figures/al-jadaan.jpg",
      title: figure.title || "وزير المالية",
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
