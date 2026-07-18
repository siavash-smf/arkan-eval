import Link from "next/link";
import { cx, faNum } from "@/lib/utils";
import { VERDICT_LABELS, type Verdict } from "@/lib/types";

/* کامپوننت‌های پایه‌ی مشترک داشبورد. همه سرور-کامپوننت‌اند مگر خلافش گفته شود. */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "pass" | "partial" | "fail";
}) {
  const toneClass = {
    default: "text-ink",
    pass: "text-pass",
    partial: "text-partial",
    fail: "text-fail",
  }[tone];

  return (
    <div className="card p-4">
      <div className="text-xs text-slate">{label}</div>
      <div className={cx("tnum mt-1 font-heading text-2xl font-bold", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate">{hint}</div>}
    </div>
  );
}

/** نمره‌ی ۰ تا ۱۰۰ با رنگ‌بندی معنادار. */
export function scoreTone(score: number): "pass" | "partial" | "fail" {
  if (score >= 80) return "pass";
  if (score >= 60) return "partial";
  return "fail";
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const tone = scoreTone(score);
  const bg = { pass: "bg-pass/10 text-pass", partial: "bg-partial/10 text-partial", fail: "bg-fail/10 text-fail" }[tone];
  const sz = { sm: "text-xs px-2 py-0.5", md: "text-sm px-2.5 py-1", lg: "text-lg px-3 py-1.5" }[size];
  return <span className={cx("tnum rounded-btn font-bold", bg, sz)}>{faNum(score)}</span>;
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const style = {
    pass: "bg-pass/10 text-pass",
    partial: "bg-partial/10 text-partial",
    fail: "bg-fail/10 text-fail",
  }[verdict];
  const icon = { pass: "✓", partial: "!", fail: "✕" }[verdict];
  return (
    <span className={cx("chip", style)}>
      <span aria-hidden>{icon}</span>
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

/** نوار نسبت موفق/نسبی/ناموفق. */
export function VerdictBar({ counts }: { counts: Record<Verdict, number> }) {
  const total = counts.pass + counts.partial + counts.fail || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-sand" title={`موفق ${counts.pass} · نسبی ${counts.partial} · ناموفق ${counts.fail}`}>
      <div className="bg-pass" style={{ width: seg(counts.pass) }} />
      <div className="bg-partial" style={{ width: seg(counts.partial) }} />
      <div className="bg-fail" style={{ width: seg(counts.fail) }} />
    </div>
  );
}

/** میله‌ی افقی برای نمره‌ی ۰ تا ۱۰. */
export function DimensionBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-32 shrink-0 text-sm text-slate">{label}</div>
        <div className="text-xs text-slate">اجرا نشد</div>
      </div>
    );
  }
  const pctValue = (value / 10) * 100;
  const tone = scoreTone(pctValue);
  const bg = { pass: "bg-pass", partial: "bg-partial", fail: "bg-fail" }[tone];
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-sm">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
        <div className={cx("h-full rounded-full", bg)} style={{ width: `${pctValue}%` }} />
      </div>
      <div className="tnum w-12 shrink-0 text-left text-sm font-medium">{faNum(value.toFixed(1))}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card grid place-items-center p-12 text-center">
      <div className="max-w-md">
        <h3 className="font-heading font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/** جعبه‌ی توضیح آموزشی — چون این پروژه قرار است یاد بدهد، نه فقط کار کند. */
export function Teach({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-brass/30 bg-brass/5 p-4 text-sm leading-7">
      <div className="mb-1 font-heading text-xs font-semibold text-brass">چرا این مهم است</div>
      {children}
    </div>
  );
}

export function NavCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="card block p-5 transition-colors hover:border-brass/50">
      <h3 className="font-heading font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate">{description}</p>
    </Link>
  );
}
