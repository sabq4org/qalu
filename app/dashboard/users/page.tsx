import { redirect } from "next/navigation";
import { requireAdmin } from "@/auth";
import UsersAdmin from "@/components/UsersAdmin";

export default async function UsersPage() {
  const user = await requireAdmin();
  if (!user) redirect("/dashboard");
  return <UsersAdmin />;
}
