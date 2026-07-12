import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const [row] = await db().select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? fallback;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const v = await getSetting(key, fallback ? "1" : "0");
  return v === "1" || v === "true" || v === "yes";
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db().select().from(settings).where(eq(settings.key, key)).limit(1);
  if (existing[0]) {
    await db()
      .update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key));
  } else {
    await db().insert(settings).values({ key, value });
  }
}

export async function listSettings(prefix?: string) {
  const rows = await db().select().from(settings);
  if (!prefix) return rows;
  return rows.filter((r) => r.key.startsWith(prefix));
}
