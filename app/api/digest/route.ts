import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { buildWeeklyDigest, getLatestDigest, listDigests } from "@/services/digest";

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get("all") === "1") {
      const items = await listDigests();
      return NextResponse.json({ items });
    }
    const latest = await getLatestDigest();
    return NextResponse.json({ digest: latest });
  } catch (err) {
    console.error("[api/digest]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

export async function POST() {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const digest = await buildWeeklyDigest();
    return NextResponse.json({ digest }, { status: 201 });
  } catch (err) {
    console.error("[api/digest POST]", err);
    return NextResponse.json({ message: "تعذر البناء" }, { status: 500 });
  }
}
