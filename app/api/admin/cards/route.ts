import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/auth";
import { buildCardImage } from "@/services/publish";
import type { CardTemplate } from "@/services/socialCard";

/**
 * GET ?id=&template=2d|2e|3a — يعيد PNG للبطاقة
 */
export async function GET(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const id = req.nextUrl.searchParams.get("id");
    const template = (req.nextUrl.searchParams.get("template") ?? "2d") as CardTemplate;
    if (!id) return NextResponse.json({ message: "id مطلوب" }, { status: 400 });
    if (!["2d", "2e", "3a"].includes(template)) {
      return NextResponse.json({ message: "قالب غير معروف" }, { status: 400 });
    }

    const result = await buildCardImage(id, template);
    if (!result) {
      return NextResponse.json({ message: "تصريح غير موجود أو غير معتمد" }, { status: 404 });
    }

    return result.image;
  } catch (err) {
    console.error("[api/admin/cards]", err);
    return NextResponse.json({ message: "تعذر توليد البطاقة" }, { status: 500 });
  }
}
