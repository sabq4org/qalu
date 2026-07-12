import { NextRequest, NextResponse } from "next/server";
import { requireEditor, requireStaff } from "@/auth";
import { writeAudit } from "@/services/audit";
import { listTopicsWithCounts, renameTopic } from "@/services/topicsAdmin";
import { findOrCreateTopic } from "@/services/review";

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q") ?? undefined;
    const limit = Math.min(Number(sp.get("limit")) || 100, 200);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const result = await listTopicsWithCounts({ q, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/topics GET]", err);
    return NextResponse.json({ message: "تعذر جلب المواضيع" }, { status: 500 });
  }
}

/** POST — إنشاء موضوع: { name } */
export async function POST(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ message: "الاسم مطلوب" }, { status: 400 });
    const topic = await findOrCreateTopic(name);
    await writeAudit({
      actorId: user.id,
      action: "topic.create",
      entityType: "topic",
      entityId: topic?.id,
      meta: { name },
    });
    return NextResponse.json({ topic }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/topics POST]", err);
    return NextResponse.json({ message: "تعذر الإنشاء" }, { status: 500 });
  }
}

/**
 * PATCH — إعادة تسمية: { id, name }
 * (أو عبر /api/admin/topics/[id])
 */
export async function PATCH(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const name = typeof body?.name === "string" ? body.name : "";
    if (!id || !name) {
      return NextResponse.json({ message: "id و name مطلوبان" }, { status: 400 });
    }
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
    console.error("[api/admin/topics PATCH]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر التحديث" },
      { status: 400 },
    );
  }
}
