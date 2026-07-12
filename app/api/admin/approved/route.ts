import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { db } from "@/db";
import { figures, statements } from "@/db/schema";
import { isXConfigured } from "@/services/xPublish";

/** قائمة تصريحات معتمدة للنشر/البطاقات */
export async function GET(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 40, 100);
    const items = await db()
      .select({
        id: statements.id,
        text: statements.text,
        context: statements.context,
        statementDate: statements.statementDate,
        sourceUrl: statements.sourceUrl,
        figureName: figures.name,
        figureTitle: figures.title,
        figureSlug: figures.slug,
      })
      .from(statements)
      .innerJoin(figures, eq(statements.figureId, figures.id))
      .where(eq(statements.status, "approved"))
      .orderBy(desc(statements.statementDate))
      .limit(limit);

    return NextResponse.json({ items, xConfigured: isXConfigured() });
  } catch (err) {
    console.error("[api/admin/approved]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}
