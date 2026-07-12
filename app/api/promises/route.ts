import { NextRequest, NextResponse } from "next/server";
import { listOpenPromises, updatePromiseStatus } from "@/services/intelligence";
import { requireEditor } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const figureId = req.nextUrl.searchParams.get("figureId") ?? undefined;
    const items = await listOpenPromises({ figureId, limit: 50 });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[api/promises]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const status = body?.status;
    if (!id || !["open", "fulfilled", "broken", "unclear"].includes(status)) {
      return NextResponse.json({ message: "معطيات غير صالحة" }, { status: 400 });
    }
    const updated = await updatePromiseStatus(id, status);
    if (!updated) return NextResponse.json({ message: "غير موجود" }, { status: 404 });
    return NextResponse.json({ statement: updated });
  } catch (err) {
    console.error("[api/promises PATCH]", err);
    return NextResponse.json({ message: "تعذر التحديث" }, { status: 500 });
  }
}
