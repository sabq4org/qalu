import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export const metadata = { title: "تسجيل الدخول", robots: "noindex, nofollow" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) redirect("/login?error=1");
      throw err;
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6 text-center">دخول فريق المراجعة</h1>
      {error && (
        <p className="mb-4 rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">
          بيانات الدخول غير صحيحة
        </p>
      )}
      <form action={login} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm mb-1">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            className="w-full rounded-lg border border-border bg-card px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm mb-1">
            كلمة المرور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            dir="ltr"
            className="w-full rounded-lg border border-border bg-card px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-accent text-accent-contrast font-bold py-2 hover:opacity-90"
        >
          دخول
        </button>
      </form>
    </div>
  );
}
