import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const metadata = { title: "لوحة التحكم", robots: "noindex, nofollow" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !["admin", "reviewer"].includes(user.role ?? "")) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-bold">لوحة التحكم — {user.name}</div>
          <form action={logout}>
            <button type="submit" className="text-sm text-muted hover:text-accent">
              تسجيل الخروج
            </button>
          </form>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/dashboard"
            className="rounded-lg border border-border px-3 py-1.5 hover:border-accent hover:text-accent"
          >
            طابور المراجعة
          </Link>
          <Link
            href="/dashboard/statements/new"
            className="rounded-lg bg-accent text-accent-contrast font-semibold px-3 py-1.5"
          >
            إدخال تصريح
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
