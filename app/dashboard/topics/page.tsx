import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import TopicsAdmin from "@/components/TopicsAdmin";

export default async function TopicsPage() {
  const user = await requireEditor();
  if (!user) redirect("/dashboard");
  return <TopicsAdmin />;
}
