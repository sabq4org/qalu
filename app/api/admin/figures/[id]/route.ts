import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, requireEditor, requireStaff } from "@/auth";
import { writeAudit } from "@/services/audit";
import {
  deleteFigure,
  getFigureAdmin,
  updateFigure,
} from "@/services/figuresAdmin";

/** GET — تفاصيل شخصية للإدارة */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const figure = await getFigureAdmin(id);
    if (!figure) return NextResponse.json({ message: "الشخصية غير موجودة" }, { status: 404 });
    return NextResponse.json({ figure });
  } catch (err) {
    console.error("[api/admin/figures/:id GET]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

/**
 * PATCH — تحرير حقول الشخصية و/أو التوثيق:
 * { name?, title?, bio?, displayOrder?, verified? }
 * التوثيق فقط: أي staff؛ باقي الحقول: editor|admin
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "جسم الطلب غير صالح" }, { status: 400 });
  }

  const patch: {
    name?: string;
    title?: string | null;
    bio?: string | null;
    displayOrder?: number;
    verified?: boolean;
  } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (body.title === null || typeof body.title === "string") patch.title = body.title;
  if (body.bio === null || typeof body.bio === "string") patch.bio = body.bio;
  if (typeof body.displayOrder === "number") patch.displayOrder = body.displayOrder;
  if (typeof body.verified === "boolean") patch.verified = body.verified;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "لا حقول للتحديث" }, { status: 400 });
  }

  const onlyVerified =
    Object.keys(patch).length === 1 && typeof patch.verified === "boolean";
  const user = onlyVerified ? await requireStaff() : await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const updated = await updateFigure(id, patch);
    if (!updated) {
      return NextResponse.json({ message: "الشخصية غير موجودة" }, { status: 404 });
    }

    await writeAudit({
      actorId: user.id,
      action: "figure.update",
      entityType: "figure",
      entityId: id,
      meta: patch,
    });

    revalidatePath(`/f/${updated.slug}`);
    revalidatePath("/");
    revalidateTag(`figure:${updated.slug}`, "max");
    revalidateTag("figures", "max");
    return NextResponse.json({ figure: updated });
  } catch (err) {
    console.error("[api/admin/figures/:id PATCH]", err);
    return NextResponse.json({ message: "تعذر تنفيذ الإجراء" }, { status: 500 });
  }
}

/** DELETE — حذف شخصية (admin فقط، cascade على التصريحات) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const deleted = await deleteFigure(id);
    if (!deleted) {
      return NextResponse.json({ message: "الشخصية غير موجودة" }, { status: 404 });
    }
    await writeAudit({
      actorId: user.id,
      action: "figure.delete",
      entityType: "figure",
      entityId: id,
      meta: { name: deleted.name, slug: deleted.slug },
    });
    revalidatePath("/");
    revalidatePath(`/f/${deleted.slug}`);
    revalidateTag("figures", "max");
    revalidateTag(`figure:${deleted.slug}`, "max");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/figures/:id DELETE]", err);
    return NextResponse.json({ message: "تعذر الحذف" }, { status: 500 });
  }
}
