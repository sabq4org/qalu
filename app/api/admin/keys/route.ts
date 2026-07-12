import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/auth";
import { writeAudit } from "@/services/audit";
import { createApiKey, listApiKeys, setApiKeyEnabled } from "@/services/b2b";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const items = await listApiKeys();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[api/admin/keys]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    if (!name.trim()) return NextResponse.json({ message: "الاسم مطلوب" }, { status: 400 });
    const { key, raw } = await createApiKey(
      name,
      typeof body?.webhookUrl === "string" ? body.webhookUrl : null,
    );
    await writeAudit({
      actorId: user.id,
      action: "api_key.create",
      entityType: "api_key",
      entityId: key.id,
      meta: { name, prefix: key.keyPrefix },
    });
    return NextResponse.json(
      { key: { id: key.id, name: key.name, keyPrefix: key.keyPrefix }, raw },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/admin/keys POST]", err);
    return NextResponse.json({ message: "تعذر الإنشاء" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id || typeof body?.enabled !== "boolean") {
      return NextResponse.json({ message: "معطيات غير صالحة" }, { status: 400 });
    }
    const updated = await setApiKeyEnabled(id, body.enabled);
    if (!updated) return NextResponse.json({ message: "غير موجود" }, { status: 404 });
    return NextResponse.json({ key: updated });
  } catch (err) {
    console.error("[api/admin/keys PATCH]", err);
    return NextResponse.json({ message: "تعذر التحديث" }, { status: 500 });
  }
}
