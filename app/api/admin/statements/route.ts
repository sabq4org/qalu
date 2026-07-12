import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaff } from "@/auth";
import {
  createManualStatement,
  listPendingStatements,
  pendingCount,
} from "@/services/review";

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit")) || 50, 100);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const [items, total] = await Promise.all([
      listPendingStatements({ limit, offset }),
      pendingCount(),
    ]);
    return NextResponse.json({ items, total, limit, offset });
  } catch (err) {
    console.error("[api/admin/statements]", err);
    return NextResponse.json({ message: "تعذر جلب قائمة المراجعة" }, { status: 500 });
  }
}

/**
 * POST — إدخال يدوي موثق (يُعتمد فوراً).
 */
export async function POST(req: NextRequest) {
  const user = await requireStaff();
  if (!user?.id) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "جسم الطلب غير صالح" }, { status: 400 });
    }

    const result = await createManualStatement({
      figureId: typeof body.figureId === "string" ? body.figureId : undefined,
      figureName: typeof body.figureName === "string" ? body.figureName : undefined,
      figureTitle: typeof body.figureTitle === "string" ? body.figureTitle : null,
      verifyFigure: Boolean(body.verifyFigure),
      text: String(body.text ?? ""),
      context: typeof body.context === "string" ? body.context : null,
      statementDate: body.statementDate,
      topicId: typeof body.topicId === "string" ? body.topicId : null,
      topicName: typeof body.topicName === "string" ? body.topicName : null,
      sourceName: String(body.sourceName ?? ""),
      sourceUrl: String(body.sourceUrl ?? ""),
      sourceTitle: typeof body.sourceTitle === "string" ? body.sourceTitle : null,
      enteredBy: user.id,
    });

    if (!result.ok) {
      const status = result.reason === "duplicate" ? 409 : 400;
      return NextResponse.json({ message: result.message }, { status });
    }

    revalidatePath("/");
    revalidatePath(`/f/${result.figureSlug}`);
    revalidateTag("statements", "max");
    revalidateTag("figures", "max");
    revalidateTag(`figure:${result.figureSlug}`, "max");
    revalidateTag(`figure-statements:${result.statement.figureId}`, "max");

    return NextResponse.json(
      { statement: result.statement, figureSlug: result.figureSlug },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/admin/statements POST]", err);
    return NextResponse.json({ message: "تعذر حفظ التصريح" }, { status: 500 });
  }
}
