import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { figures, statements } from "@/db/schema";

/** بذرة يومية ثابتة من التاريخ UTC */
export function dailySeed(d = new Date()): number {
  const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * لعبة «من قال هذا؟» — تصريح يومي + 3 خيارات خاطئة من شخصيات أخرى.
 */
export async function getDailyQuiz(d = new Date()) {
  const seed = dailySeed(d);
  const approved = await db()
    .select({
      id: statements.id,
      text: statements.text,
      figureId: figures.id,
      figureName: figures.name,
      figureSlug: figures.slug,
      figureTitle: figures.title,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .where(eq(statements.status, "approved"))
    .orderBy(desc(statements.statementDate))
    .limit(200);

  if (approved.length < 4) {
    return null;
  }

  const pick = approved[seed % approved.length];
  const distractors = approved
    .filter((a) => a.figureId !== pick.figureId)
    .sort((a, b) => {
      // خلط شبه حتمي من البذرة
      const ha = (seed ^ a.figureId.charCodeAt(0)) % 997;
      const hb = (seed ^ b.figureId.charCodeAt(0)) % 997;
      return ha - hb;
    })
    .slice(0, 3);

  // إن لم تكفِ شخصيات مختلفة، أكمل من كل الشخصيات
  if (distractors.length < 3) {
    const moreFigures = await db()
      .select({
        id: figures.id,
        name: figures.name,
        slug: figures.slug,
        title: figures.title,
      })
      .from(figures)
      .where(ne(figures.id, pick.figureId))
      .limit(12);
    const shuffled = [...moreFigures].sort(
      (a, b) => ((seed + a.id.length) % 11) - ((seed + b.id.length) % 11),
    );
    for (const f of shuffled.slice(0, 3 - distractors.length)) {
      distractors.push({
        id: `fig-${f.id}`,
        text: "",
        figureId: f.id,
        figureName: f.name,
        figureSlug: f.slug,
        figureTitle: f.title,
      });
    }
  }

  const options = [
    {
      figureId: pick.figureId,
      name: pick.figureName,
      title: pick.figureTitle,
      slug: pick.figureSlug,
      correct: true,
    },
    ...distractors.map((d) => ({
      figureId: d.figureId,
      name: d.figureName,
      title: d.figureTitle,
      slug: d.figureSlug,
      correct: false,
    })),
  ].sort((a, b) => ((seed + a.figureId.charCodeAt(0)) % 7) - ((seed + b.figureId.charCodeAt(0)) % 7));

  return {
    date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      .toISOString()
      .slice(0, 10),
    statementId: pick.id,
    quote: pick.text,
    options: options.map(({ figureId, name, title, slug }) => ({
      figureId,
      name,
      title,
      slug,
    })),
    /** يُرسل فقط عند التحقق من السيرفر */
    _correctFigureId: pick.figureId,
  };
}

export function gradeQuiz(correctFigureId: string, chosenFigureId: string) {
  return {
    correct: correctFigureId === chosenFigureId,
    correctFigureId,
  };
}
