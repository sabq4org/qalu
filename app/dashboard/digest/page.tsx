import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import DigestAdminActions from "@/components/DigestAdminActions";

export default async function DigestDashboardPage() {
  const user = await requireEditor();
  if (!user) redirect("/dashboard");
  return <DigestAdminActions />;
}
