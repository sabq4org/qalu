import OpenAI from "openai";
import { z } from "zod";
import { searchStatements } from "@/services/search";

const answerSchema = z.object({
  answer: z.string(),
  citedIds: z.array(z.string()),
  insufficientEvidence: z.boolean(),
});

/**
 * اسأل الأرشيف — إجابة مقيّدة بالمصادر فقط.
 * إن لم يوجد دليل كافٍ يُصرَّح بذلك صراحة.
 */
export async function askArchive(question: string): Promise<{
  answer: string;
  citations: Array<{
    id: string;
    text: string;
    figureName: string;
    figureSlug: string;
    statementDate: Date;
    sourceUrl: string;
    score: number;
  }>;
  insufficientEvidence: boolean;
}> {
  const q = question.trim();
  if (q.length < 3) {
    return {
      answer: "صغ سؤالاً أوضح (٣ أحرف على الأقل).",
      citations: [],
      insufficientEvidence: true,
    };
  }

  const { items } = await searchStatements(q, { limit: 8, mode: "hybrid" });
  const citations = items.map((i) => ({
    id: i.id,
    text: i.text,
    figureName: i.figureName,
    figureSlug: i.figureSlug,
    statementDate: i.statementDate,
    sourceUrl: i.sourceUrl,
    score: i.score,
  }));

  if (citations.length === 0) {
    return {
      answer: "لا تصريح موثّق في الأرشيف يجيب على هذا السؤال.",
      citations: [],
      insufficientEvidence: true,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    const top = citations[0];
    return {
      answer: `أقرب تصريح موثّق: ${top.figureName} قال «${top.text}»`,
      citations,
      insufficientEvidence: false,
    };
  }

  try {
    const openai = new OpenAI();
    const context = citations
      .map(
        (c, i) =>
          `[${i + 1}] id=${c.id} | ${c.figureName} | ${new Date(c.statementDate).toISOString().slice(0, 10)}\n«${c.text}»\nمصدر: ${c.sourceUrl}`,
      )
      .join("\n\n");

    const res = await openai.chat.completions.create({
      model: process.env.SEARCH_INTERPRET_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `أنت مساعد أرشيف «ماذا قالوا؟». تجيب فقط من التصريحات المرقّمة.
قواعد صارمة:
- لا تختلق أسماء أو تواريخ أو معاني.
- إن لم يكفِ الدليل: insufficientEvidence=true وanswer يوضح أنه لا تصريح موثّق كافٍ.
- اقتبس حرفياً بين «» عند الاستشهاد.
- أرجع JSON: { "answer": string, "citedIds": string[], "insufficientEvidence": boolean }`,
        },
        { role: "user", content: `السؤال: ${q}\n\nالتصاريح:\n${context}` },
      ],
    });

    const parsed = answerSchema.safeParse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
    if (!parsed.success) {
      return {
        answer: "تعذر صياغة إجابة موثوقة — راجع التصريحات أدناه.",
        citations,
        insufficientEvidence: true,
      };
    }

    const citedSet = new Set(parsed.data.citedIds);
    const filtered = citations.filter((c) => citedSet.has(c.id));
    return {
      answer: parsed.data.answer,
      citations: filtered.length ? filtered : citations.slice(0, 3),
      insufficientEvidence: parsed.data.insufficientEvidence,
    };
  } catch (err) {
    console.error("[askArchive]", err);
    return {
      answer: "حدث خطأ أثناء التحليل. التصريحات ذات الصلة معروضة أدناه.",
      citations,
      insufficientEvidence: true,
    };
  }
}
