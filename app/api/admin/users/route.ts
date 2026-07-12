import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/auth";
import { writeAudit } from "@/services/audit";
import { createUser, listUsers, updateUser } from "@/services/usersAdmin";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const items = await listUsers();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[api/admin/users GET]", err);
    return NextResponse.json({ message: "تعذر الجلب" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ message: "جسم الطلب غير صالح" }, { status: 400 });
    const created = await createUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      name: String(body.name ?? ""),
      role: typeof body.role === "string" ? body.role : "reviewer",
    });
    await writeAudit({
      actorId: user.id,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      meta: { email: created.email, role: created.role },
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/users POST]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر الإنشاء" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ message: "id مطلوب" }, { status: 400 });
    if (id === user.id && body.disabled === true) {
      return NextResponse.json({ message: "لا يمكن تعطيل حسابك الحالي" }, { status: 400 });
    }
    const updated = await updateUser(id, {
      role: typeof body.role === "string" ? body.role : undefined,
      disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
    });
    if (!updated) return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
    await writeAudit({
      actorId: user.id,
      action: "user.update",
      entityType: "user",
      entityId: id,
      meta: { role: body.role, disabled: body.disabled },
    });
    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[api/admin/users PATCH]", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر التحديث" },
      { status: 400 },
    );
  }
}
