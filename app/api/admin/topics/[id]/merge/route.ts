import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { writeAudit } from "@/services/audit";
import { mergeTopics } from "@/services/topicsAdmin";

/** POST — دمج: { dropTopicId } في الموضوع الحالي (keep = :id) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id: keepId } = await params;
    const body = await req.json().catch(() => null);
    const dropId = typeof body?.dropTopicId === "string" ? body.dropTopicId : "";
    if (!dropId) {
      return NextResponse.json({ message: "dropTopicId مطلوب" }, { status: 400 });
    }
    const keep = await mergeTopics(keepId, dropId);
    if (!keep) {
      return NextResponse.json({ message: "أحد الموضوعين غير موجود" }, { status: 404 });
    }
    await writeAudit({
      actorId: user.id,
      action: "topic.merge",
      entityType: "topic",
      entityId: keepId,
      meta: { dropTopicId: dropId },
    });
    return NextResponse.json({ topic: keep });
  } catch (err) {
    console.error("[api/admin/topics/:id/merge]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر الدمج" },
      { status: 500 },
    );
  }
}
