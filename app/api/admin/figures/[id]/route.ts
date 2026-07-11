import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaff } from "@/auth";
import { setFigureVerified } from "@/services/review";

/** PATCH — توثيق/إلغاء توثيق شخصية: { verified: boolean } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (typeof body?.verified !== "boolean") {
      return NextResponse.json({ message: "verified مطلوب" }, { status: 400 });
    }
    const updated = await setFigureVerified(id, body.verified);
    if (!updated) {
      return NextResponse.json({ message: "الشخصية غير موجودة" }, { status: 404 });
    }
    revalidatePath(`/f/${updated.slug}`);
    revalidatePath("/");
    revalidateTag(`figure:${updated.slug}`, "max");
    revalidateTag("figures", "max");
    return NextResponse.json({ figure: updated });
  } catch (err) {
    console.error("[api/admin/figures/:id]", err);
    return NextResponse.json({ message: "تعذر تنفيذ الإجراء" }, { status: 500 });
  }
}
