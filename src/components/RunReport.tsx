"use client";

import { useEffect, useState } from "react";
import type { CaseResult, EvalRun, Verdict } from "@/lib/types";
import { VERDICT_LABELS, VERDICTS } from "@/lib/types";
import { cx, faNum, ms, pct } from "@/lib/utils";
import { formatUsd } from "@/lib/pricing";
import { apiFetch } from "@/lib/client-auth";
import { DIMENSION_LABELS } from "@/lib/judges/scoring";
import { DimensionBar, EmptyState, ScoreBadge, Stat, Teach, VerdictBar, VerdictChip } from "./ui";

/**
 * گزارش یک اجرا.
 *
 * تا وقتی اجرا در جریان است، هر ۲ ثانیه وضعیت را می‌گیرد. چون runner
 * بعد از هر کیس پیشرفت را ذخیره می‌کند، کاربر نتایج را زنده می‌بیند
 * به‌جای اینکه چند دقیقه به یک اسپینر نگاه کند.
 */
export function RunReport({ runId, initial }: { runId: string; initial: EvalRun | null }) {
  const [run, setRun] = useState<EvalRun | null>(initial);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [pollError, setPollError] = useState("");

  useEffect(() => {
    if (run?.status === "done" || run?.status === "error") return;

    const timer = setInterval(async () => {
      const res = await apiFetch(`/api/runs/${runId}`);

      // اگر رمز نداشته باشیم، هر ۲ ثانیه ۴۰۱ می‌گیریم و صفحه بی‌صدا
      // یخ می‌زند. بهتر است کاربر بداند چرا پیشرفتی نمی‌بیند.
      if (res.status === 401) {
        setPollError("رمز داشبورد ثبت نشده — پیشرفت زنده به‌روز نمی‌شود.");
        return;
      }
      if (!res.ok) return;

      setPollError("");
      const { run: fresh } = await res.json();
      setRun(fresh);
    }, 2000);

    return () => clearInterval(timer);
  }, [runId, run?.status]);

  if (!run) {
    return (
      <EmptyState
        title="اجرا پیدا نشد"
        description="ممکن است هنوز شروع نشده باشد، یا اگر روی حافظه کار می‌کنید سرور ری‌استارت شده باشد."
      />
    );
  }

  const s = run.summary;
  const results = filter === "all" ? run.results : run.results.filter((r) => r.verdict === filter);

  return (
    <div className="space-y-6">
      {/* ── وضعیت اجرا ── */}
      {run.status === "running" && (
        <div className="card flex items-center gap-4 p-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full bg-brass transition-all"
              style={{ width: `${(run.progress.done / Math.max(1, run.progress.total)) * 100}%` }}
            />
          </div>
          <span className="tnum shrink-0 text-sm text-slate">
            {faNum(run.progress.done)} از {faNum(run.progress.total)} کیس
          </span>
        </div>
      )}

      {pollError && (
        <div className="rounded-card bg-fail/10 p-4 text-sm text-fail">{pollError}</div>
      )}

      {run.error && (
        <div className="rounded-card bg-fail/10 p-4 text-sm text-fail">خطای اجرا: {run.error}</div>
      )}

      {/* ── خلاصه ── */}
      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="نمره‌ی کل"
              value={`${faNum(s.overallScore)}/۱۰۰`}
              tone={s.overallScore >= 80 ? "pass" : s.overallScore >= 60 ? "partial" : "fail"}
              hint="میانگین وزن‌دار همه‌ی کیس‌ها"
            />
            <Stat
              label="موفق / نسبی / ناموفق"
              value={`${faNum(s.counts.pass)} / ${faNum(s.counts.partial)} / ${faNum(s.counts.fail)}`}
            />
            <Stat
              label="تأخیر میانگین"
              value={ms(s.latency.avgMs)}
              hint={`p95: ${ms(s.latency.p95Ms)}`}
            />
            <Stat
              label="هزینه‌ی داوری"
              value={formatUsd(s.judgeCostUsd)}
              hint={`${faNum(s.judgeTokens.in + s.judgeTokens.out)} توکن`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* نمره‌ی ابعاد */}
            <div className="card p-5">
              <h2 className="mb-4 font-heading font-semibold">نمره‌ی ابعاد</h2>
              <div className="space-y-3">
                <DimensionBar label={DIMENSION_LABELS.expectation} value={s.dimensions.expectation} />
                <DimensionBar label={DIMENSION_LABELS.faithfulness} value={s.dimensions.faithfulness} />
                <DimensionBar label={DIMENSION_LABELS.safety} value={s.dimensions.safety} />
                <DimensionBar label={DIMENSION_LABELS.brandVoice} value={s.dimensions.brandVoice} />
              </div>
              <p className="mt-4 text-xs leading-6 text-slate">
                هر بُعد را یک داور مستقل با روبریک خودش سنجیده است. وزن‌ها در
                <code className="mx-1 text-ink">src/lib/judges/scoring.ts</code>
                تعریف شده‌اند و قابل تغییرند.
              </p>
            </div>

            {/* تفکیک دسته‌ای */}
            <div className="card p-5">
              <h2 className="mb-4 font-heading font-semibold">تفکیک دسته‌ای</h2>
              <div className="space-y-3">
                {s.byCategory.map((c) => (
                  <div key={c.category}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{c.category}</span>
                      <ScoreBadge score={c.score} size="sm" />
                    </div>
                    <VerdictBar counts={c.counts} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {s.knowledgeGaps > 0 && (
            <Teach>
              در {faNum(s.knowledgeGaps)} کیس، انتظار داشتیم پاسخ از پایگاه دانش پشتیبانی شود
              اما هیچ منبعی بازیابی نشد. این یعنی یا سؤال خارج از پوشش دانش است، یا بازیابی
              خوب کار نمی‌کند. راهنمای ارزیابی این فهرست را{" "}
              <strong>ارزشمندترین داده برای بهبود</strong> می‌داند — هر کدام یک سند تازه برای
              پایگاه دانش است.
            </Teach>
          )}
        </>
      )}

      {/* ── فیلتر ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate">نمایش:</span>
        {(["all", ...VERDICTS] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cx(
              "rounded-btn px-3 py-1 text-sm transition-colors",
              filter === v ? "bg-pine text-bone" : "border border-sand bg-white hover:bg-sand/40"
            )}
          >
            {v === "all" ? "همه" : VERDICT_LABELS[v]}
            {v !== "all" && s && ` (${faNum(s.counts[v])})`}
          </button>
        ))}
      </div>

      {/* ── کیس‌ها ── */}
      <div className="space-y-3">
        {results.map((r) => (
          <CaseCard key={r.caseId} result={r} runId={runId} />
        ))}
        {!results.length && (
          <p className="py-8 text-center text-sm text-slate">کیسی با این فیلتر وجود ندارد.</p>
        )}
      </div>
    </div>
  );
}

/* ── کارت یک کیس ────────────────────────────────────────── */

function CaseCard({ result: r, runId }: { result: CaseResult; runId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-sand/20"
      >
        <ScoreBadge score={r.finalScore} />
        <VerdictChip verdict={r.verdict} />
        <span className="min-w-0 flex-1 truncate text-sm">{r.question}</span>
        <code className="shrink-0 text-xs text-slate">{r.caseId}</code>
        <span className="shrink-0 text-xs text-slate">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-sand bg-bone/40 p-4">
          {r.error && (
            <div className="rounded-btn bg-fail/10 px-3 py-2 text-sm text-fail">خطا: {r.error}</div>
          )}

          {/* رونوشت گفتگو */}
          <section>
            <h4 className="mb-2 font-heading text-sm font-semibold">رونوشت گفتگو</h4>
            <div className="space-y-2">
              {r.transcript.map((t, i) => (
                <div
                  key={i}
                  className={cx(
                    "rounded-card px-3 py-2 text-sm leading-7",
                    t.role === "user" ? "bg-sand/50" : "border border-sand bg-white"
                  )}
                >
                  <div className="mb-1 text-xs text-slate">
                    {t.role === "user" ? "کاربر" : "بات"}
                  </div>
                  <div className="whitespace-pre-wrap">{t.text}</div>
                </div>
              ))}
            </div>
          </section>

          {/* داورها */}
          <section className="grid gap-3 md:grid-cols-2">
            {r.expectation && (
              <JudgeCard
                title={DIMENSION_LABELS.expectation}
                score={r.expectation.score}
                reasoning={r.expectation.reasoning}
                flags={r.expectation.failureSignalPresent ? ["نشانه‌ی شکست دیده شد"] : []}
              />
            )}
            {r.faithfulness && (
              <JudgeCard
                title={DIMENSION_LABELS.faithfulness}
                score={r.faithfulness.score}
                reasoning={r.faithfulness.reasoning}
                flags={[
                  ...r.faithfulness.unsupportedClaims.map((c) => `ادعای بی‌پشتوانه: ${c}`),
                  ...(r.faithfulness.admittedUncertainty ? ["صادقانه ابراز بی‌اطلاعی کرد"] : []),
                ]}
                positive={r.faithfulness.admittedUncertainty}
              />
            )}
            {r.safety && (
              <JudgeCard
                title={DIMENSION_LABELS.safety}
                score={r.safety.score}
                reasoning={r.safety.reasoning}
                flags={[
                  ...(r.safety.brokeCharacter ? ["از نقش خارج شد"] : []),
                  ...(r.safety.leakedPrompt ? ["پرامپت داخلی را فاش کرد"] : []),
                  ...(r.safety.unfoundedCommitment ? ["تعهد بی‌مبنا داد"] : []),
                ]}
              />
            )}
            {r.brandVoice && (
              <JudgeCard
                title={DIMENSION_LABELS.brandVoice}
                score={r.brandVoice.score}
                reasoning={r.brandVoice.reasoning}
                flags={r.brandVoice.violations}
              />
            )}
          </section>

          {/* بررسی‌های قطعی */}
          <section>
            <h4 className="mb-2 font-heading text-sm font-semibold">
              بررسی‌های قطعی <span className="font-normal text-slate">(کد، بدون مدل)</span>
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <Fact label="طول" value={`${faNum(r.checks.wordCount)} کلمه`} />
              <Fact label="تأخیر" value={ms(r.latencyMs)} />
              <Fact label="منابع بازیابی‌شده" value={faNum(r.checks.sourceCount)} bad={r.checks.retrievalMismatch} />
              {r.checks.maxSimilarity !== null && (
                <Fact label="بیشترین شباهت" value={faNum(r.checks.maxSimilarity.toFixed(2))} />
              )}
              <Fact label="علامت تعجب" value={faNum(r.checks.exclamationCount)} bad={r.checks.exclamationCount > 2} />
              {r.checks.bannedPhrases.length > 0 && (
                <Fact label="عبارت ممنوعه" value={r.checks.bannedPhrases.join("، ")} bad />
              )}
              {r.checks.promptLeakSuspected && <Fact label="نشت پرامپت" value="مشکوک" bad />}
              {r.checks.retrievalMismatch && <Fact label="شکاف دانش" value="منبعی بازیابی نشد" bad />}
            </div>
          </section>

          {/* منابع */}
          {r.sources.length > 0 && (
            <section>
              <h4 className="mb-2 font-heading text-sm font-semibold">منابع بازیابی‌شده</h4>
              <ul className="space-y-1 text-xs">
                {r.sources.map((src, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="tnum w-10 shrink-0 text-slate">
                      {faNum(src.similarity?.toFixed(2) ?? "—")}
                    </span>
                    <span className="truncate">{src.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <HumanLabeler runId={runId} caseId={r.caseId} judgeVerdict={r.verdict} />
        </div>
      )}
    </div>
  );
}

function JudgeCard({
  title,
  score,
  reasoning,
  flags,
  positive,
}: {
  title: string;
  score: number;
  reasoning: string;
  flags: string[];
  positive?: boolean;
}) {
  return (
    <div className="rounded-card border border-sand bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold">{title}</span>
        <ScoreBadge score={score * 10} size="sm" />
      </div>
      <p className="text-xs leading-6 text-slate">{reasoning}</p>
      {flags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {flags.map((f, i) => (
            <li
              key={i}
              className={cx("rounded px-2 py-1 text-xs", positive ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail")}
            >
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <span
      className={cx(
        "rounded-btn px-2 py-1",
        bad ? "bg-fail/10 text-fail" : "border border-sand bg-white text-slate"
      )}
    >
      {label}: <span className="tnum font-medium text-ink">{value}</span>
    </span>
  );
}

/* ── برچسب‌زنی انسانی ───────────────────────────────────── */

/**
 * اینجا انسان با داور مخالفت (یا موافقت) می‌کند.
 * هر برچسب یک نقطه‌داده برای صفحه‌ی «داورِ داور» می‌سازد.
 */
function HumanLabeler({
  runId,
  caseId,
  judgeVerdict,
}: {
  runId: string;
  caseId: string;
  judgeVerdict: Verdict;
}) {
  const [saved, setSaved] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function save(humanVerdict: Verdict) {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, caseId, humanVerdict, judgeVerdict, note }),
      });

      if (res.ok) {
        setSaved(humanVerdict);
        return;
      }

      // شکست را حتماً نشان می‌دهیم. نسخه‌ی قبلی این تابع خطا را
      // بی‌صدا می‌بلعید: کاربر کلیک می‌کرد، هیچ اتفاقی نمی‌افتاد، و
      // فکر می‌کرد ثبت شده — در حالی که سرور ۴۰۱ برگردانده بود.
      if (res.status === 401) {
        setError("رمز داشبورد ثبت نشده یا اشتباه است. آن را در بالای صفحه وارد کنید.");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `ثبت نشد — سرور کد ${res.status} برگرداند.`);
      }
    } catch (e) {
      setError(`ثبت نشد: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-brass/30 bg-brass/5 p-3">
      <h4 className="font-heading text-sm font-semibold">نظر شما چیست؟</h4>
      <p className="mt-1 text-xs leading-6 text-slate">
        داور حکم «{VERDICT_LABELS[judgeVerdict]}» داده. اگر موافق نیستید ثبت کنید — این
        برچسب‌ها در صفحه‌ی «داورِ داور» برای سنجش خودِ داور استفاده می‌شوند.
      </p>

      <input
        className="field mt-2 text-xs"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="یادداشت اختیاری: چرا موافق یا مخالفید؟"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v}
            disabled={busy}
            onClick={() => save(v)}
            className={cx(
              "rounded-btn px-3 py-1 text-xs transition-colors",
              saved === v ? "bg-pine text-bone" : "border border-sand bg-white hover:bg-sand/40"
            )}
          >
            {VERDICT_LABELS[v]}
          </button>
        ))}
        {saved && <span className="text-xs text-pass">ثبت شد ✓</span>}
      </div>

      {error && (
        <p className="mt-2 rounded-btn bg-fail/10 px-3 py-2 text-xs text-fail">{error}</p>
      )}

      {saved && (
        <p className="mt-2 text-xs text-slate">
          در صفحه‌ی{" "}
          <a href="/judge" className="text-brass hover:underline">
            داورِ داور
          </a>{" "}
          می‌توانید هم‌خوانی داور با قضاوت خودتان را ببینید.
        </p>
      )}
    </section>
  );
}
