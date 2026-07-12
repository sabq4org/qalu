import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { STAFF_ROLES, type StaffRole } from "@/auth";

export async function listUsers() {
  return await db()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  const password = input.password;
  if (!email || !name || password.length < 8) {
    throw new Error("البريد والاسم وكلمة مرور (≥8) مطلوبة");
  }
  const role = (input.role ?? "reviewer") as StaffRole;
  if (!STAFF_ROLES.includes(role)) throw new Error("دور غير صالح");

  const [existing] = await db().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("البريد مستخدم مسبقاً");

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db()
    .insert(users)
    .values({ email, passwordHash, name, role })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      createdAt: users.createdAt,
    });
  return created;
}

export async function updateUser(
  id: string,
  patch: { role?: string; disabled?: boolean; name?: string; password?: string },
) {
  const set: Record<string, unknown> = {};
  if (patch.role !== undefined) {
    if (!STAFF_ROLES.includes(patch.role as StaffRole)) throw new Error("دور غير صالح");
    set.role = patch.role;
  }
  if (patch.disabled !== undefined) set.disabled = patch.disabled;
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.password) {
    if (patch.password.length < 8) throw new Error("كلمة المرور قصيرة");
    set.passwordHash = await bcrypt.hash(patch.password, 12);
  }
  if (Object.keys(set).length === 0) return null;
  const [updated] = await db()
    .update(users)
    .set(set)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      createdAt: users.createdAt,
    });
  return updated ?? null;
}
