import Link from "next/link";

export function formatArabicDate(date: Date | string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("ar", { dateStyle: "long" }).format(new Date(date));
}

export interface StatementCardProps {
  text: string;
  statementDate: Date | string | null;
  sourceUrl: string;
  sourceTitle?: string | null;
  sourceName?: string | null;
  context?: string | null;
  topicName?: string | null;
  figureName?: string | null;
  figureTitle?: string | null;
  figureSlug?: string | null;
}

/** بطاقة التصريح — قالب 2d من الهوية: قوس تيل، اقتباس SemiBold، السياق، والمصدر مسمّى */
export default function StatementCard(props: StatementCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {props.figureName && props.figureSlug && (
          <>
            <Link
              href={`/f/${encodeURIComponent(props.figureSlug)}`}
              className="font-bold text-accent hover:underline"
            >
              {props.figureName}
            </Link>
            {props.figureTitle && <span className="text-sm text-muted">{props.figureTitle}</span>}
          </>
        )}
        <time className="tabular text-sm font-semibold text-accent whitespace-nowrap">
          {formatArabicDate(props.statementDate)}
        </time>
      </div>
      <div aria-hidden className="text-accent text-3xl font-bold leading-none h-4 select-none">
        «
      </div>
      <blockquote className="text-lg font-semibold leading-relaxed mt-1">
        {props.text}
      </blockquote>
      {props.context && (
        <p className="mt-3 text-sm text-muted leading-relaxed flex gap-2">
          <span aria-hidden className="w-0.5 self-stretch rounded bg-accent/50 shrink-0" />
          {props.context}
        </p>
      )}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-3 text-sm text-muted">
        {props.topicName && (
          <span className="rounded-full bg-accent-soft px-3 py-0.5 text-accent font-semibold">
            {props.topicName}
          </span>
        )}
        <a
          href={props.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent font-semibold hover:underline"
          title={props.sourceTitle ?? undefined}
        >
          المصدر: {props.sourceName ?? "صحيفة سبق"} ↗
        </a>
      </div>
    </article>
  );
}
