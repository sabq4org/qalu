import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { requireEditor } from "@/auth";
import { db } from "@/db";
import { figures } from "@/db/schema";
import { writeAudit } from "@/services/audit";
import { isStorageConfigured, mediaUrl, uploadObject } from "@/services/objectStorage";

const MAX_BYTES = 2_500_000; // ~2.5MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST multipart — رفع صورة شخصية إلى Railway Bucket.
 * الحقل: file (صورة)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { message: "تخزين S3 غير مضبوط على هذه البيئة" },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const [figure] = await db().select().from(figures).where(eq(figures.id, id)).limit(1);
    if (!figure) return NextResponse.json({ message: "الشخصية غير موجودة" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "file مطلوب" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ message: "صيغة غير مدعومة (jpeg/png/webp)" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: "الحجم أكبر من 2.5MB" }, { status: 400 });
    }

    const ext =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `figures/${figure.slug}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const imageUrl = await uploadObject(key, buf, file.type);

    const [updated] = await db()
      .update(figures)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(figures.id, id))
      .returning();

    await writeAudit({
      actorId: user.id,
      action: "figure.image",
      entityType: "figure",
      entityId: id,
      meta: { key },
    });

    revalidatePath(`/f/${updated.slug}`);
    revalidatePath("/");
    revalidateTag(`figure:${updated.slug}`, "max");
    revalidateTag("figures", "max");

    return NextResponse.json({ figure: updated, imageUrl: mediaUrl(key) });
  } catch (err) {
    console.error("[api/admin/figures/:id/image]", err);
    return NextResponse.json({ message: "تعذر رفع الصورة" }, { status: 500 });
  }
}
