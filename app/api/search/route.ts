import { NextRequest, NextResponse } from "next/server";
import { searchStatements, suggestFigures } from "@/services/search";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const suggest = sp.get("suggest") === "figures";
    if (suggest) {
      const figures = await suggestFigures(q, 8);
      return NextResponse.json({ figures });
    }

    if (q.length < 2) {
      return NextResponse.json({
        items: [],
        interpretation: null,
        mode: "hybrid",
        tookMs: 0,
        message: "أدخل حرفين على الأقل",
      });
    }

    const limit = Math.min(Number(sp.get("limit")) || 20, 50);
    const modeParam = sp.get("mode");
    const mode =
      modeParam === "keyword" || modeParam === "semantic" || modeParam === "hybrid"
        ? modeParam
        : "hybrid";

    const result = await searchStatements(q, { limit, mode });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/search]", err);
    return NextResponse.json({ message: "تعذر البحث" }, { status: 500 });
  }
}
