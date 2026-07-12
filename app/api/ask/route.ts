import { NextRequest, NextResponse } from "next/server";
import { askArchive } from "@/services/askArchive";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question : "";
    const result = await askArchive(question);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/ask]", err);
    return NextResponse.json({ message: "تعذر الإجابة" }, { status: 500 });
  }
}
