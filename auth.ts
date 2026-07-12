import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const STAFF_ROLES = ["admin", "editor", "reviewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const { handlers, auth, signIn, signOut } = NextAuth({
  // خلف بروكسي (Cloudflare → Railway) يجب الوثوق بترويسة المضيف
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const [user] = await db()
          .select()
          .from(users)
          .where(and(eq(users.email, email), eq(users.disabled, false)))
          .limit(1);
        if (!user || user.disabled) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

type SessionUser = { id: string; role?: string | null; name?: string | null; email?: string | null };

/** أي فرد من الطاقم (admin | editor | reviewer) */
export async function requireStaff(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !STAFF_ROLES.includes((user.role ?? "") as StaffRole)) return null;
  return user as SessionUser;
}

/** admin أو editor — تحرير شخصيات/مواضيع/إدخال */
export async function requireEditor(): Promise<SessionUser | null> {
  const user = await requireStaff();
  if (!user || !["admin", "editor"].includes(user.role ?? "")) return null;
  return user;
}

/** admin فقط */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await requireStaff();
  if (!user || user.role !== "admin") return null;
  return user;
}
