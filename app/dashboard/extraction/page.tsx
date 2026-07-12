import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import ExtractionOps from "@/components/ExtractionOps";

export default async function ExtractionPage() {
  const user = await requireEditor();
  if (!user) redirect("/dashboard");
  return <ExtractionOps />;
}
