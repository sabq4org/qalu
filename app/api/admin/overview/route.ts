import { NextResponse } from "next/server";
import { requireStaff } from "@/auth";
import { getDashboardOverview } from "@/services/ops";

export async function GET() {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const overview = await getDashboardOverview();
    return NextResponse.json(overview);
  } catch (err) {
    console.error("[api/admin/overview]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}
