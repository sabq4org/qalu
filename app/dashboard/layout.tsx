import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const metadata = { title: "لوحة المراجعة", robots: "noindex, nofollow" };

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
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div className="font-bold">لوحة المراجعة — {user.name}</div>
        <form action={logout}>
          <button type="submit" className="text-sm text-muted hover:text-accent">
            تسجيل الخروج
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
