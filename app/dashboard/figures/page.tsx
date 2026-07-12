import { redirect } from "next/navigation";
import { requireEditor } from "@/auth";
import FiguresAdmin from "@/components/FiguresAdmin";

export default async function FiguresPage() {
  const user = await requireEditor();
  if (!user) redirect("/dashboard");
  return <FiguresAdmin />;
}
