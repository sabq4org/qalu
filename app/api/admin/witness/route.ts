import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { runWitnessCheck } from "@/services/witness";

export async function POST(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const statementId = String(form.get("statementId") ?? "");
      const transcript = form.get("transcript");
      const file = form.get("audio");
      if (!statementId) {
        return NextResponse.json({ message: "statementId مطلوب" }, { status: 400 });
      }
      let audio: Buffer | undefined;
      let audioFilename: string | undefined;
      if (file instanceof File && file.size > 0) {
        audio = Buffer.from(await file.arrayBuffer());
        audioFilename = file.name;
      }
      const result = await runWitnessCheck({
        statementId,
        transcript: typeof transcript === "string" ? transcript : undefined,
        audio,
        audioFilename,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.statementId) {
      return NextResponse.json({ message: "statementId مطلوب" }, { status: 400 });
    }
    const result = await runWitnessCheck({
      statementId: String(body.statementId),
      transcript: typeof body.transcript === "string" ? body.transcript : undefined,
      mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[api/witness]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر الفحص" },
      { status: 400 },
    );
  }
}
