import { NextRequest, NextResponse } from "next/server";
import { getApprovedStatements, getFigureBySlug } from "@/services/figures";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const figure = await getFigureBySlug(decodeURIComponent(slug));
    if (!figure) {
      return NextResponse.json({ message: "الشخصية غير موجودة" }, { status: 404 });
    }
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit")) || 50, 100);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const items = await getApprovedStatements(figure.id, { limit, offset });
    return NextResponse.json(
      {
        figure: {
          id: figure.id,
          name: figure.name,
          title: figure.title,
          slug: figure.slug,
          imageUrl: figure.imageUrl,
          bio: figure.bio,
          verified: figure.verified,
        },
        statements: items,
        limit,
        offset,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    console.error("[api/figures/slug]", err);
    return NextResponse.json({ message: "تعذر جلب ملف الشخصية" }, { status: 500 });
  }
}
