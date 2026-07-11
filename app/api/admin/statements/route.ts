import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/auth";
import { listPendingStatements, pendingCount } from "@/services/review";

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
