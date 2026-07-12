import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import PublishDashboard from "@/components/PublishDashboard";

export default async function PublishPage() {
  const user = await requireEditor();
  if (!user) redirect("/dashboard");
  return <PublishDashboard />;
}
