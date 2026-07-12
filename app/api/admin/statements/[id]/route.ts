import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/auth";
import { db } from "@/db";
import { figures, statements } from "@/db/schema";
import { writeAudit } from "@/services/audit";
import {
  approveStatement,
  reassignStatement,
  rejectStatement,
  restoreStatement,
} from "@/services/review";

/**
 * PATCH — إجراء مراجعة على تصريح:
 * { action: "approve" } | { action: "reject", reason? } | { action: "restore" } |
 * { action: "reassign", figureId?, topicId?, context? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body?.action) {
      return NextResponse.json({ message: "action مطلوب" }, { status: 400 });
    }

    let updated = null;
    if (body.action === "approve") {
      updated = await approveStatement(id, user.id);
    } else if (body.action === "reject") {
      updated = await rejectStatement(id, user.id, body.reason);
    } else if (body.action === "restore") {
      updated = await restoreStatement(id, user.id);
    } else if (body.action === "reassign") {
      updated = await reassignStatement(id, {
        figureId: body.figureId,
        topicId: body.topicId,
        context: body.context !== undefined ? body.context : undefined,
      });
    } else {
      return NextResponse.json({ message: "إجراء غير معروف" }, { status: 400 });
    }

    if (!updated) {
      return NextResponse.json({ message: "التصريح غير موجود" }, { status: 404 });
    }

    await writeAudit({
      actorId: user.id,
      action: `statement.${body.action}`,
      entityType: "statement",
      entityId: id,
      meta: { reason: body.reason },
    });

    const [figure] = await db()
      .select({ id: figures.id, slug: figures.slug })
      .from(figures)
      .innerJoin(statements, eq(statements.figureId, figures.id))
      .where(eq(statements.id, id))
      .limit(1);
    if (figure) {
      revalidatePath(`/f/${figure.slug}`);
      revalidateTag(`figure:${figure.slug}`, "max");
      revalidateTag(`figure-statements:${figure.id}`, "max");
    }
    revalidatePath("/");
    revalidateTag("statements", "max");
    revalidateTag("figures", "max");

    return NextResponse.json({ statement: updated });
  } catch (err) {
    console.error("[api/admin/statements/:id]", err);
    return NextResponse.json({ message: "تعذر تنفيذ الإجراء" }, { status: 500 });
  }
}
