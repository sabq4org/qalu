import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements } from "@/db/schema";

/** بيانات ويدجت عامة لشخصية — آخر التصريحات المعتمدة */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 3, 10);
    const [figure] = await db()
      .select()
      .from(figures)
      .where(eq(figures.slug, decodeURIComponent(slug)))
      .limit(1);
    if (!figure) return NextResponse.json({ message: "غير موجود" }, { status: 404 });

    const items = await db()
      .select({
        id: statements.id,
        text: statements.text,
        statementDate: statements.statementDate,
        sourceUrl: statements.sourceUrl,
        sourceName: statements.sourceName,
      })
      .from(statements)
      .where(and(eq(statements.figureId, figure.id), eq(statements.status, "approved")))
      .orderBy(desc(statements.statementDate))
      .limit(limit);

    return NextResponse.json({
      figure: {
        name: figure.name,
        title: figure.title,
        slug: figure.slug,
        imageUrl: figure.imageUrl,
        verified: figure.verified,
      },
      statements: items,
      site: process.env.NEXT_PUBLIC_SITE_URL ?? "https://qalu.dev",
    });
  } catch (err) {
    console.error("[api/embed]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}
