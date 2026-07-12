import { NextRequest, NextResponse } from "next/server";
import { b2bListStatements, verifyApiKey } from "@/services/b2b";

function bearer(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() ?? null;
}

/** GET /api/v1/statements — يتطلب مفتاح qalu_… */
export async function GET(req: NextRequest) {
  const key = await verifyApiKey(bearer(req));
  if (!key) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const items = await b2bListStatements({
      limit: Number(sp.get("limit")) || 50,
      figureSlug: sp.get("figure") ?? undefined,
    });
    return NextResponse.json({
      items,
      meta: { key: key.keyPrefix, count: items.length },
    });
  } catch (err) {
    console.error("[api/v1/statements]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}
