import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { writeAudit } from "@/services/audit";
import {
  getExtractionSettings,
  listExtractionRuns,
  requestRunOnce,
  updateExtractionSettings,
} from "@/services/ops";

export async function GET() {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const [settings, runs] = await Promise.all([
      getExtractionSettings(),
      listExtractionRuns(30),
    ]);
    return NextResponse.json({ settings, runs });
  } catch (err) {
    console.error("[api/admin/extraction GET]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

/**
 * PATCH — تحديث إعدادات: { enabled?, batchSize?, saudiGulfOnly? }
 * POST — { action: "runOnce" } يضع العلم للـ worker
 */
export async function PATCH(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "جسم الطلب غير صالح" }, { status: 400 });
    }
    const settings = await updateExtractionSettings({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      batchSize: typeof body.batchSize === "number" ? body.batchSize : undefined,
      saudiGulfOnly: typeof body.saudiGulfOnly === "boolean" ? body.saudiGulfOnly : undefined,
    });
    await writeAudit({
      actorId: user.id,
      action: "extraction.settings",
      entityType: "settings",
      meta: body,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("[api/admin/extraction PATCH]", err);
    return NextResponse.json({ message: "تعذر التحديث" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "runOnce") {
      return NextResponse.json({ message: "action غير معروف" }, { status: 400 });
    }
    await requestRunOnce();
    await writeAudit({
      actorId: user.id,
      action: "extraction.runOnce",
      entityType: "settings",
    });
    return NextResponse.json({ ok: true, message: "ستُنفَّذ الدفعة عند الدورة التالية للـ worker" });
  } catch (err) {
    console.error("[api/admin/extraction POST]", err);
    return NextResponse.json({ message: "تعذر الطلب" }, { status: 500 });
  }
}
