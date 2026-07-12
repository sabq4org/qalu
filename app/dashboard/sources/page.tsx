import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import SourcesAdmin from "@/components/SourcesAdmin";

export default async function SourcesPage() {
  const user = await requireEditor();
  if (!user) redirect("/dashboard");
  return <SourcesAdmin />;
}
