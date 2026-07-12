import { eq } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements } from "@/db/schema";
import { renderSocialCard, type CardTemplate } from "@/services/socialCard";

export async function getApprovedStatementForCard(id: string) {
  const [row] = await db()
    .select({
      id: statements.id,
      text: statements.text,
      context: statements.context,
      statementDate: statements.statementDate,
      status: statements.status,
      sourceUrl: statements.sourceUrl,
      figureName: figures.name,
      figureTitle: figures.title,
      figureSlug: figures.slug,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .where(eq(statements.id, id))
    .limit(1);
  return row ?? null;
}

export async function buildCardImage(statementId: string, template: CardTemplate) {
  const row = await getApprovedStatementForCard(statementId);
  if (!row || row.status !== "approved") return null;

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(row.statementDate));

  const image = renderSocialCard({
    text: row.text,
    figureName: row.figureName,
    figureTitle: row.figureTitle,
    context: row.context,
    dateLabel,
    template,
  });

  return { image, row };
}

export function tweetIntentText(row: {
  text: string;
  figureName: string;
  figureSlug: string;
  id: string;
}) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qalu.dev";
  const link = `${site.replace(/\/$/, "")}/f/${encodeURIComponent(row.figureSlug)}`;
  const quote = row.text.length > 180 ? `${row.text.slice(0, 179)}…` : row.text;
  return `«${quote}»\n— ${row.figureName}\n\n${link}`;
}
