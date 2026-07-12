import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireEditor } from "@/auth";
import { writeAudit } from "@/services/audit";
import {
  createSource,
  deleteSource,
  ensureDefaultSources,
  listSources,
  updateSource,
} from "@/services/sourcesAdmin";

export async function GET() {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    await ensureDefaultSources();
    const items = await listSources();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[api/admin/sources GET]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body?.name) return NextResponse.json({ message: "الاسم مطلوب" }, { status: 400 });
    const created = await createSource({
      name: String(body.name),
      slug: typeof body.slug === "string" ? body.slug : undefined,
      rssUrl: typeof body.rssUrl === "string" ? body.rssUrl : null,
      enabled: body.enabled !== false,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    await writeAudit({
      actorId: user.id,
      action: "source.create",
      entityType: "source",
      entityId: created.id,
      meta: { name: created.name },
    });
    return NextResponse.json({ source: created }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/sources POST]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر الإنشاء" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ message: "id مطلوب" }, { status: 400 });
    const updated = await updateSource(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      rssUrl: body.rssUrl === null || typeof body.rssUrl === "string" ? body.rssUrl : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      notes: body.notes === null || typeof body.notes === "string" ? body.notes : undefined,
    });
    if (!updated) return NextResponse.json({ message: "المصدر غير موجود" }, { status: 404 });
    await writeAudit({
      actorId: user.id,
      action: "source.update",
      entityType: "source",
      entityId: id,
      meta: body,
    });
    return NextResponse.json({ source: updated });
  } catch (err) {
    console.error("[api/admin/sources PATCH]", err);
    return NextResponse.json({ message: "تعذر التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ message: "id مطلوب" }, { status: 400 });
    const deleted = await deleteSource(id);
    if (!deleted) return NextResponse.json({ message: "المصدر غير موجود" }, { status: 404 });
    if (deleted.slug === "sabq") {
      // أعد إنشاء سبق إن حُذف بالخطأ
      await ensureDefaultSources();
    }
    await writeAudit({
      actorId: user.id,
      action: "source.delete",
      entityType: "source",
      entityId: id,
      meta: { name: deleted.name },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/sources DELETE]", err);
    return NextResponse.json({ message: "تعذر الحذف" }, { status: 500 });
  }
}
