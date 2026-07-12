import { auth } from "@/auth";
import FigureEditForm from "@/components/FigureEditForm";

export default async function FigureEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role ?? "reviewer";
  return <FigureEditForm figureId={id} role={role} />;
}
