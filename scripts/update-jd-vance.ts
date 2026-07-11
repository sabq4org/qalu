/**
 * تحديث نبذة جيه دي فانس (+ صورة إن وُجدت في public/figures).
 * التشغيل: npx tsx scripts/update-jd-vance.ts
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
  'جيه دي فانس هو نائب رئيس الولايات المتحدة الحالي (تولى المنصب عام 2025)، وهو سياسي جمهوري، ومحامٍ، ومؤلف كتاب "رثاء هيلبيلي" الشهير. تدرج من الخدمة في المارينز والاستثمار التكنولوجي إلى تمثيل ولاية أوهايو في مجلس الشيوخ، ليصبح اليوم أحد أبرز الوجوه المحافظة في الإدارة الأمريكية.';

async function main() {
  const { eq, ilike, or } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { figures } = await import("../db/schema");

  const rows = await db()
    .select()
    .from(figures)
    .where(
      or(
        ilike(figures.name, "%فانس%"),
        ilike(figures.slug, "%vance%"),
        ilike(figures.name, "%Vance%"),
        ilike(figures.name, "%جي دي%"),
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
  const imageUrl = "/figures/jd-vance.jpg";

  const [updated] = await db()
    .update(figures)
    .set({
      name: "جي دي فانس",
      title: "نائب الرئيس الأمريكي",
      bio: BIO,
      imageUrl,
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
    bio: updated.bio?.slice(0, 80) + "…",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
