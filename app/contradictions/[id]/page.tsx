import ContradictionsClient from "@/components/ContradictionsClient";

export const metadata = { title: "تتبّع التناقض" };

export default async function ContradictionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContradictionsClient statementId={id} />;
}
