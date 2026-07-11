import { NextRequest, NextResponse } from "next/server";
import { listFiguresWithCounts } from "@/services/figures";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit")) || 24, 100);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const items = await listFiguresWithCounts({ limit, offset });
    return NextResponse.json(
      { items, limit, offset },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    console.error("[api/figures]", err);
    return NextResponse.json({ message: "تعذر جلب الشخصيات" }, { status: 500 });
  }
}
