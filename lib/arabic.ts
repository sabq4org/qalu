import { createHash } from "crypto";

/**
 * تطبيع عربي للمقارنة الحرفية:
 * إزالة التشكيل والتطويل، توحيد الهمزات والألف المقصورة والتاء المربوطة،
 * إزالة علامات الاقتباس والترقيم، وتوحيد المسافات.
 * يُستخدم للمطابقة فقط — النص المخزن يبقى حرفياً كما ورد.
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ْٰـ]/g, "") // تشكيل + تطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[«»""''"'،؛؟!.,:;()\[\]{}<>…—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** هل النص المقتبس موجود حرفياً (بعد التطبيع) داخل متن المقال؟ */
export function quoteAppearsInContent(quote: string, content: string): boolean {
  const q = normalizeArabic(quote);
  if (q.length < 10) return false; // اقتباس أقصر من ذلك لا يعتد به
  return normalizeArabic(stripHtml(content)).includes(q);
}

/** إزالة وسوم HTML من متن المقال قبل المطابقة */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** بصمة منع التكرار: نص التصريح المطبع + الاسم المطبع للشخصية */
export function dedupeHash(quote: string, figureNormalizedName: string): string {
  return createHash("sha256")
    .update(`${normalizeArabic(quote)}|${figureNormalizedName}`)
    .digest("hex");
}

/** توليد slug من الاسم العربي (يُبقي الأحرف العربية — الروابط تدعمها) */
export function slugifyArabic(name: string): string {
  return normalizeArabic(name)
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .replace(/ +/g, "-");
}
