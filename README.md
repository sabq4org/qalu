# قالوا — أرشيف التصريحات الموثق

منصة تجمع تصريحات الشخصيات العامة العربية كما وردت **حرفياً** في الصحافة، كل تصريح برابط مقاله الأصلي وتاريخه. الاستخراج آلي (gpt-4o-mini) من أرشيف صحيفة سبق، والنشر **بعد اعتماد بشري فقط**.

## المبادئ غير القابلة للتفاوض

1. **المصدر إلزامي في المخطط**: `sourceArticleId` و `sourceUrl` بـ `notNull` — القاعدة نفسها ترفض تصريحاً بلا مصدر.
2. **الاقتباس الحرفي مقدس**: الحارس الحرفي في `lib/arabic.ts` يتحقق أن النص موجود فعلاً في متن المقال (بعد تطبيع عربي) — ما لا يوجد يُسقط قبل دخول القاعدة.
3. **لا نشر آلي**: المسار الوحيد الذي يضع `status = 'approved'` هو `approveStatement` في `services/review.ts` خلف مصادقة فريق المراجعة.
4. **منع التكرار**: `dedupeHash` فريد (نص مطبع + شخصية) مع `onConflictDoNothing`.

## البنية

```
app/            الصفحات (App Router) — الرئيسية، /f/[slug]، /login، /dashboard
app/api/        المسارات: عامة (figures) وإدارية (admin/* خلف الجلسة)
db/             schema.ts (Drizzle) + index.ts (قاعدة qalu) + sabq.ts (سبق قراءة فقط)
services/       منطق الاستعلامات (figures / review)
worker/         extraction.ts — الاستخراج المجدول (كل ساعتين، Asia/Riyadh)
lib/arabic.ts   التطبيع العربي + الحارس الحرفي + dedupeHash
scripts/        seed-admin.ts
```

## التشغيل الأول

```bash
cp .env.example .env.local        # واملأ القيم
npm install
npm run db:push                   # مزامنة المخطط مع قاعدة qalu
npm run seed:admin                # إنشاء مستخدم الأدمن (يقرأ ADMIN_* من env)
npm run dev                       # http://localhost:3000
```

### مستخدم القراءة-فقط في قاعدة سبق (مرة واحدة، يدوياً)

```sql
CREATE USER qalu_reader WITH PASSWORD '...';
GRANT SELECT ON articles TO qalu_reader;
```

> ممنوع منح `qalu_reader` أي صلاحية غير SELECT، وممنوع استيراد `db/sabq.ts` خارج `worker/`.

## الاستخراج

```bash
npm run extract:once   # دفعة واحدة (للتجربة وضبط البرومبت)
npm run worker         # تشغيل مستمر: دفعة كل ساعتين
```

- الدفعة: حتى `EXTRACT_BATCH_SIZE` (افتراضي 50) مقالاً منشوراً نوع `news` أطول من 400 حرف.
- أول تشغيل يبدأ من آخر `EXTRACT_SINCE_DAYS` (افتراضي 90) يوماً، ثم يتقدم المؤشر في `extraction_runs`.
- المؤشر يتقدم حتى مع فشل مقالات مفردة — لا حلقة إعادة معالجة.
- **قبل فتح الأرشيف التاريخي**: جرّب `extract:once` على دفعات وراجع نسب الرفض الحرفي في `extraction_runs`؛ عدّل البرومبت في `worker/prompt.ts` إن لزم.

## النشر (Railway + Neon)

خدمتان من نفس الـ repo:

| الخدمة | أمر التشغيل | ملاحظات |
|--------|-------------|---------|
| web | `npm run build && npm start` | تحتاج كل env عدا OPENAI |
| worker | `npm run worker` | تحتاج DATABASE_URL و SABQ_DATABASE_URL و OPENAI_API_KEY |

## قرارات معمارية مسجلة

- صفحات الشخصيات ISR (`revalidate = 300`) + `revalidatePath` فوري عند الاعتماد/الرفض.
- صفحة شخصية غير موثقة أو بلا تصريح معتمد = `noindex, follow`؛ الـ sitemap يضم الموثقات فقط.
- جدول `articles` في سبق **ليس فيه** `published_at` — النشر يُعرف بـ `status = 'published'`، وتاريخ التصريح الافتراضي هو `created_at` للمقال.
- الملخص (`aiSummary`) والموضوع مولّدان آلياً ومعلّمان كذلك في الواجهة؛ نص التصريح لا يمسه الذكاء الاصطناعي.
