import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireEditor, requireStaff } from "@/auth";
import { writeAudit } from "@/services/audit";
import { createFigure, listFiguresAdmin } from "@/services/figuresAdmin";

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q") ?? undefined;
    const verifiedParam = sp.get("verified");
    let verified: boolean | null = null;
    if (verifiedParam === "true") verified = true;
    else if (verifiedParam === "false") verified = false;
    const limit = Math.min(Number(sp.get("limit")) || 50, 200);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const result = await listFiguresAdmin({ q, verified, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/figures GET]", err);
    return NextResponse.json({ message: "تعذر جلب الشخصيات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireEditor();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json({ message: "الاسم مطلوب" }, { status: 400 });
    }
    const created = await createFigure({
      name: body.name,
      title: typeof body.title === "string" ? body.title : null,
      bio: typeof body.bio === "string" ? body.bio : null,
      verified: Boolean(body.verified),
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
    });
    await writeAudit({
      actorId: user.id,
      action: "figure.create",
      entityType: "figure",
      entityId: created.id,
      meta: { name: created.name },
    });
    revalidatePath("/");
    revalidateTag("figures", "max");
    return NextResponse.json({ figure: created }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/figures POST]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر إنشاء الشخصية" },
      { status: 500 },
    );
  }
}
