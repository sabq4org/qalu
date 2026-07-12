import type { MetadataRoute } from "next";
import { db } from "@/db";
import { figures } from "@/db/schema";
import { eq } from "drizzle-orm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "weekly", priority: 0.7 },
  ];

  try {
    const verified = await db()
      .select({ slug: figures.slug, updatedAt: figures.updatedAt })
      .from(figures)
      .where(eq(figures.verified, true));
    for (const f of verified) {
      entries.push({
        url: `${SITE_URL}/f/${encodeURIComponent(f.slug)}`,
        lastModified: f.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch (err) {
    console.error("[sitemap]", err);
  }

  return entries;
}
