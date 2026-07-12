import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut, STAFF_ROLES, type StaffRole } from "@/auth";

export const metadata = { title: "لوحة التحكم", robots: "noindex, nofollow" };

function NavLink({ href, children, strong }: { href: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={
        strong
          ? "rounded-lg bg-accent text-accent-contrast font-semibold px-3 py-1.5"
          : "rounded-lg border border-border px-3 py-1.5 hover:border-accent hover:text-accent"
      }
    >
      {children}
    </Link>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const role = (user?.role ?? "") as StaffRole;
  if (!user?.id || !STAFF_ROLES.includes(role)) {
    redirect("/login");
  }

  const canEdit = role === "admin" || role === "editor";
  const isAdmin = role === "admin";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-bold">
            لوحة التحكم — {user.name}
            <span className="text-muted font-normal text-sm mr-2">({role})</span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-sm text-muted hover:text-accent">
              تسجيل الخروج
            </button>
          </form>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <NavLink href="/dashboard">نظرة عامة</NavLink>
          <NavLink href="/dashboard/review">المراجعة</NavLink>
          <NavLink href="/dashboard/statements/new" strong>
            إدخال تصريح
          </NavLink>
          {canEdit && <NavLink href="/dashboard/figures">الشخصيات</NavLink>}
          {canEdit && <NavLink href="/dashboard/topics">المواضيع</NavLink>}
          {canEdit && <NavLink href="/dashboard/publish">بطاقات / إكس</NavLink>}
          {canEdit && <NavLink href="/dashboard/extraction">الاستخراج</NavLink>}
          {canEdit && <NavLink href="/dashboard/sources">المصادر</NavLink>}
          {isAdmin && <NavLink href="/dashboard/users">المستخدمون</NavLink>}
        </nav>
      </div>
      {children}
    </div>
  );
}
