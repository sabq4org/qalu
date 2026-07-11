import { NextResponse } from "next/server";
import { requireStaff } from "@/auth";
import { listFiguresBasic } from "@/services/figures";
import { listTopics } from "@/services/review";

/** بيانات قوائم الإسناد في لوحة المراجعة: الشخصيات والمواضيع */
export async function GET() {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const [figuresList, topicsList] = await Promise.all([listFiguresBasic(), listTopics()]);
    return NextResponse.json({ figures: figuresList, topics: topicsList });
  } catch (err) {
    console.error("[api/admin/meta]", err);
    return NextResponse.json({ message: "تعذر جلب البيانات" }, { status: 500 });
  }
}
