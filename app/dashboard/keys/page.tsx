import { redirect } from "next/navigation";
import { requireAdmin } from "@/auth";
import ApiKeysAdmin from "@/components/ApiKeysAdmin";

export default async function KeysPage() {
  const user = await requireAdmin();
  if (!user) redirect("/dashboard");
  return <ApiKeysAdmin />;
}
