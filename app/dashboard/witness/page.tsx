import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import WitnessForm from "@/components/WitnessForm";

export default async function WitnessPage() {
  const user = await requireEditor();
  if (!user) redirect("/login");
  return <WitnessForm />;
}
