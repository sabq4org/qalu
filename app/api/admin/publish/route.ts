import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { writeAudit } from "@/services/audit";
import {
  buildCardImage,
  getApprovedStatementForCard,
  tweetIntentText,
} from "@/services/publish";
import type { CardTemplate } from "@/services/socialCard";
import { publishToX } from "@/services/xPublish";

/**
 * POST { statementId, template?, mode?: "intent"|"api" }
 * — يجهّز نص المنشور وصورة؛ ينشر عبر X API إن وُجدت المفاتيح وmode=api
 */
export async function POST(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const statementId = typeof body?.statementId === "string" ? body.statementId : "";
    const template = (typeof body?.template === "string" ? body.template : "2d") as CardTemplate;
    const mode = body?.mode === "api" ? "api" : "intent";

    if (!statementId) {
      return NextResponse.json({ message: "statementId مطلوب" }, { status: 400 });
    }
    if (!["2d", "2e", "3a"].includes(template)) {
      return NextResponse.json({ message: "قالب غير معروف" }, { status: 400 });
    }

    const row = await getApprovedStatementForCard(statementId);
    if (!row || row.status !== "approved") {
      return NextResponse.json({ message: "تصريح غير معتمد" }, { status: 404 });
    }

    const text = tweetIntentText(row);
    const cardUrl = `/api/admin/cards?id=${encodeURIComponent(statementId)}&template=${template}`;
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

    if (mode === "api") {
      const built = await buildCardImage(statementId, template);
      if (!built) {
        return NextResponse.json({ message: "تعذر توليد الصورة" }, { status: 500 });
      }
      const png = Buffer.from(await built.image.arrayBuffer());
      const result = await publishToX({ text, png });
      await writeAudit({
        actorId: user.id,
        action: result.ok ? "statement.publish_x" : "statement.publish_x_failed",
        entityType: "statement",
        entityId: statementId,
        meta: { template, mode, ...("tweetId" in result ? { tweetId: result.tweetId } : { error: result.error }) },
      });
      if (!result.ok) {
        return NextResponse.json(
          { message: result.error, intentUrl, cardUrl, text },
          { status: 503 },
        );
      }
      return NextResponse.json({
        ok: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
        intentUrl,
        cardUrl,
        text,
      });
    }

    await writeAudit({
      actorId: user.id,
      action: "statement.publish_intent",
      entityType: "statement",
      entityId: statementId,
      meta: { template },
    });

    return NextResponse.json({ ok: true, intentUrl, cardUrl, text });
  } catch (err) {
    console.error("[api/admin/publish]", err);
    return NextResponse.json({ message: "تعذر النشر" }, { status: 500 });
  }
}
