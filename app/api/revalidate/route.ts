import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * إبطال كاش الصفحات العامة — محمي بـ REVALIDATE_SECRET.
 * مثال: POST /api/revalidate?secret=...
 */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
  }

  revalidateTag("figures", "max");
  revalidateTag("statements", "max");
  revalidatePath("/");
  revalidatePath("/f", "layout");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
