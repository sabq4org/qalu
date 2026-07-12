import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireEditor } from "@/auth";
import { writeAudit } from "@/services/audit";
import { deleteTopic, renameTopic } from "@/services/topicsAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    if (!name) return NextResponse.json({ message: "name مطلوب" }, { status: 400 });
    const updated = await renameTopic(id, name);
    if (!updated) return NextResponse.json({ message: "الموضوع غير موجود" }, { status: 404 });
    await writeAudit({
      actorId: user.id,
      action: "topic.rename",
      entityType: "topic",
      entityId: id,
      meta: { name },
    });
    return NextResponse.json({ topic: updated });
  } catch (err) {
    console.error("[api/admin/topics/:id PATCH]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر التحديث" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const deleted = await deleteTopic(id);
    if (!deleted) return NextResponse.json({ message: "الموضوع غير موجود" }, { status: 404 });
    await writeAudit({
      actorId: user.id,
      action: "topic.delete",
      entityType: "topic",
      entityId: id,
      meta: { name: deleted.name },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/topics/:id DELETE]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر الحذف" },
      { status: 400 },
    );
  }
}
