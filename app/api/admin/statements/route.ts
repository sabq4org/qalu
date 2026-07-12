import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaff } from "@/auth";
import { writeAudit } from "@/services/audit";
import {
  bulkReview,
  createManualStatement,
  listPendingStatements,
  pendingCount,
  type StatementListStatus,
} from "@/services/review";

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit")) || 50, 100);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const statusParam = sp.get("status");
    const status: StatementListStatus =
      statusParam === "rejected" ? "rejected" : "pending";
    const figureId = sp.get("figureId") ?? undefined;
    const topicId = sp.get("topicId") ?? undefined;
    const minConfidenceRaw = sp.get("minConfidence");
    const minConfidence =
      minConfidenceRaw != null && minConfidenceRaw !== ""
        ? Number(minConfidenceRaw)
        : undefined;
    const q = sp.get("q") ?? undefined;
    const sourceName = sp.get("sourceName") ?? undefined;

    const filters = { status, figureId, topicId, minConfidence, q, sourceName };
    const [items, total] = await Promise.all([
      listPendingStatements({ ...filters, limit, offset }),
      pendingCount(filters),
    ]);
    return NextResponse.json({ items, total, limit, offset, ...filters });
  } catch (err) {
    console.error("[api/admin/statements]", err);
    return NextResponse.json({ message: "تعذر جلب قائمة المراجعة" }, { status: 500 });
  }
}

/**
 * POST — إدخال يدوي، أو إجراء جماعي:
 * { action: "approve"|"reject"|"restore", ids: string[], reason? }
 */
export async function POST(req: NextRequest) {
  const user = await requireStaff();
  if (!user?.id) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "جسم الطلب غير صالح" }, { status: 400 });
    }

    if (body.action && Array.isArray(body.ids)) {
      const action = body.action as string;
      if (!["approve", "reject", "restore"].includes(action)) {
        return NextResponse.json({ message: "إجراء غير معروف" }, { status: 400 });
      }
      const ids = (body.ids as unknown[]).filter((x): x is string => typeof x === "string");
      if (ids.length === 0) {
        return NextResponse.json({ message: "ids فارغة" }, { status: 400 });
      }
      const done = await bulkReview(
        ids,
        action as "approve" | "reject" | "restore",
        user.id,
        typeof body.reason === "string" ? body.reason : undefined,
      );
      await writeAudit({
        actorId: user.id,
        action: `statement.bulk_${action}`,
        entityType: "statement",
        meta: { ids: done, reason: body.reason },
      });
      revalidatePath("/");
      revalidateTag("statements", "max");
      revalidateTag("figures", "max");
      return NextResponse.json({ ok: true, processed: done.length, ids: done });
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

    await writeAudit({
      actorId: user.id,
      action: "statement.create_manual",
      entityType: "statement",
      entityId: result.statement.id,
    });

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
