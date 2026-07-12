import { NextRequest, NextResponse } from "next/server";
import { getDailyQuiz, gradeQuiz } from "@/services/quiz";

export async function GET() {
  try {
    const quiz = await getDailyQuiz();
    if (!quiz) {
      return NextResponse.json(
        { message: "يلزم ٤ تصريحات معتمدة على الأقل من شخصيات مختلفة" },
        { status: 503 },
      );
    }
    const { _correctFigureId, ...publicQuiz } = quiz;
    return NextResponse.json({
      ...publicQuiz,
      // لا نكشف الإجابة في GET — التحقق عبر POST
    });
  } catch (err) {
    console.error("[api/quiz]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const chosen = typeof body?.figureId === "string" ? body.figureId : "";
    const quiz = await getDailyQuiz();
    if (!quiz || !chosen) {
      return NextResponse.json({ message: "طلب غير صالح" }, { status: 400 });
    }
    const result = gradeQuiz(quiz._correctFigureId, chosen);
    const correctOption = quiz.options.find((o) => o.figureId === quiz._correctFigureId);
    return NextResponse.json({
      ...result,
      correctName: correctOption?.name,
      statementId: quiz.statementId,
      figureSlug: correctOption?.slug,
    });
  } catch (err) {
    console.error("[api/quiz POST]", err);
    return NextResponse.json({ message: "تعذر التحقق" }, { status: 500 });
  }
}
