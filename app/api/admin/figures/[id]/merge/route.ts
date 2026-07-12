import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireEditor } from "@/auth";
import { writeAudit } from "@/services/audit";
import { mergeFigures } from "@/services/figuresAdmin";

/** POST — دمج شخصية مكررة في الحالية: { dropFigureId } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id: keepId } = await params;
    const body = await req.json().catch(() => null);
    const dropId = typeof body?.dropFigureId === "string" ? body.dropFigureId : "";
    if (!dropId) {
      return NextResponse.json({ message: "dropFigureId مطلوب" }, { status: 400 });
    }

    const keep = await mergeFigures(keepId, dropId);
    if (!keep) {
      return NextResponse.json({ message: "إحدى الشخصيتين غير موجودة" }, { status: 404 });
    }

    await writeAudit({
      actorId: user.id,
      action: "figure.merge",
      entityType: "figure",
      entityId: keepId,
      meta: { dropFigureId: dropId },
    });

    revalidatePath("/");
    revalidatePath(`/f/${keep.slug}`);
    revalidateTag("figures", "max");
    revalidateTag(`figure:${keep.slug}`, "max");
    revalidateTag(`figure-statements:${keepId}`, "max");
    revalidateTag("statements", "max");

    return NextResponse.json({ figure: keep });
  } catch (err) {
    console.error("[api/admin/figures/:id/merge]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر الدمج" },
      { status: 500 },
    );
  }
}
