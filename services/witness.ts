import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { figures, statements, witnessChecks } from "@/db/schema";
import { normalizeArabic } from "@/lib/arabic";

const verdictSchema = z.object({
  verdict: z.enum(["match", "partial", "mismatch"]),
  matchScore: z.number().min(0).max(1),
  notes: z.string(),
});

function overlapScore(a: string, b: string): number {
  const ta = new Set(normalizeArabic(a).split(/\s+/).filter((w) => w.length > 2));
  const tb = new Set(normalizeArabic(b).split(/\s+/).filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

/**
 * نسخة الشاهد: مطابقة تفريغ نصي (أو من صوت عبر Whisper) مع تصريح معتمد.
 */
export async function runWitnessCheck(input: {
  statementId: string;
  transcript?: string;
  /** مسار ملف صوتي محلي/buffer — يُفرَّغ عبر Whisper إن وُجد */
  audio?: Buffer;
  audioFilename?: string;
  mediaUrl?: string | null;
}) {
  const [stmt] = await db()
    .select({
      id: statements.id,
      text: statements.text,
      status: statements.status,
      figureName: figures.name,
    })
    .from(statements)
    .innerJoin(figures, eq(statements.figureId, figures.id))
    .where(eq(statements.id, input.statementId))
    .limit(1);

  if (!stmt || stmt.status !== "approved") {
    throw new Error("التصريح غير موجود أو غير معتمد");
  }

  let transcript = input.transcript?.trim() ?? "";

  if (!transcript && input.audio && process.env.OPENAI_API_KEY) {
    const openai = new OpenAI();
    const file = new File(
      [new Uint8Array(input.audio)],
      input.audioFilename ?? "audio.webm",
      { type: "audio/webm" },
    );
    const tr = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ar",
    });
    transcript = tr.text?.trim() ?? "";
  }

  if (!transcript) throw new Error("التفريغ أو الملف الصوتي مطلوب");

  let verdict: "match" | "partial" | "mismatch" = "partial";
  let matchScore = overlapScore(stmt.text, transcript);
  let notes = `تداخل لفظي تقريبي: ${Math.round(matchScore * 100)}٪`;

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI();
      const res = await openai.chat.completions.create({
        model: process.env.SEARCH_INTERPRET_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `قارن تصريحاً منشوراً حرفياً مع تفريغ مرئي/صوتي.
JSON: { "verdict": "match"|"partial"|"mismatch", "matchScore": 0-1, "notes": string بالعربية }
match = المعنى والجمل الجوهرية متطابقة؛ partial = اختلاف صياغة أو اختصار؛ mismatch = محتوى مختلف.`,
          },
          {
            role: "user",
            content: `المنشور («${stmt.figureName}»):\n${stmt.text}\n\nالتفريغ:\n${transcript}`,
          },
        ],
      });
      const parsed = verdictSchema.safeParse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
      if (parsed.success) {
        verdict = parsed.data.verdict;
        matchScore = parsed.data.matchScore;
        notes = parsed.data.notes;
      }
    } catch (err) {
      console.error("[witness/ai]", err);
    }
  } else {
    verdict = matchScore >= 0.75 ? "match" : matchScore >= 0.4 ? "partial" : "mismatch";
  }

  const [saved] = await db()
    .insert(witnessChecks)
    .values({
      statementId: stmt.id,
      transcript,
      mediaUrl: input.mediaUrl ?? null,
      matchScore,
      verdict,
      notes,
    })
    .returning();

  return { check: saved, statement: stmt };
}
