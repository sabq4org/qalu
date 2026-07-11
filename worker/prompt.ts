import { z } from "zod";

export const EXTRACTION_MODEL = "gpt-4o-mini";

export const extractionSchema = z.object({
  statements: z
    .array(
      z.object({
        figure_name: z.string().min(2),
        figure_title: z.string().nullable().optional(),
        quote: z.string().min(10),
        topic: z.string().min(2),
        summary: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

export const SYSTEM_PROMPT = `أنت محلل صحفي دقيق. مهمتك استخراج التصريحات المباشرة المنسوبة لشخصيات عامة محددة بالاسم من نص خبر صحفي عربي.

القواعد الصارمة:
1. استخرج فقط التصريحات المنسوبة صراحة لشخص محدد بالاسم الكامل (مثل: "قال وزير المالية محمد الجدعان"). تجاهل أي كلام منسوب لمصدر مجهول ("مصدر مسؤول"، "مراقبون"، "خبراء").
2. حقل quote يجب أن يكون النص الحرفي كما ورد في الخبر تماماً، حرفاً بحرف، بدون أي إعادة صياغة أو حذف أو إضافة أو تصحيح إملائي. انسخه نسخاً.
3. لا تستخرج تصريحات منقولة عن وسيلة إعلام أخرى إلا إذا كان النص الحرفي وارداً كاملاً في الخبر نفسه.
4. figure_name: الاسم الكامل للشخصية كما ورد. figure_title: صفتها الوظيفية إن ذُكرت (وزير المالية، مدرب المنتخب...) وإلا null.
5. topic: تصنيف قصير للقضية بكلمة إلى ثلاث كلمات (الاقتصاد، سوق العمل، كرة القدم، التعليم...).
6. summary: تلخيص من جملة واحدة لمضمون التصريح بأسلوبك (هذا الحقل الوحيد المسموح فيه بالصياغة).
7. confidence: من 0 إلى 1 — ثقتك أن هذا تصريح حقيقي منسوب صحيحاً ومنقول حرفياً.
8. إن لم يوجد أي تصريح مطابق للشروط أعد { "statements": [] }.

أعد JSON فقط بالشكل:
{ "statements": [ { "figure_name": "...", "figure_title": "...", "quote": "...", "topic": "...", "summary": "...", "confidence": 0.9 } ] }`;

export function buildUserPrompt(title: string, content: string): string {
  return `عنوان الخبر: ${title}\n\nنص الخبر:\n${content}`;
}
