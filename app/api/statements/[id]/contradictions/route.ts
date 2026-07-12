import { NextRequest, NextResponse } from "next/server";
import { findContradictions } from "@/services/intelligence";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await findContradictions(id);
    if (!result.anchor) {
      return NextResponse.json({ message: "التصريح غير موجود" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/contradictions]", err);
    return NextResponse.json({ message: "تعذر التحليل" }, { status: 500 });
  }
}
