import { judgeModelId, type Usage } from "./ai";
import { runChecks } from "./judges/checks";
import {
  judgeBrandVoice,
  judgeExpectation,
  judgeFaithfulness,
  judgeSafety,
} from "./judges/rubrics";
import { computeFinalScore, summarize } from "./judges/scoring";
import { costUsd } from "./pricing";
import type { BlogStoreLike } from "./store";
import type {
  CaseResult,
  EvalCase,
  EvalRun,
  EvalTarget,
  Suite,
} from "./types";

/* ────────────────────────────────────────────────────────────
   ارکستریتور اجرای ارزیابی.

   درسِ فاز ۳ دوباره اینجاست: **این کد است، نه یک ایجنت.**
   ترتیب کارها قطعی و قابل‌پیش‌بینی است. هیچ مدلی تصمیم نمی‌گیرد
   که کیس بعدی کدام است یا کدام داور اجرا شود.

   مدل فقط جایی دخالت می‌کند که واقعاً قضاوت لازم است.
   ──────────────────────────────────────────────────────────── */

export type RunOptions = {
  runId: string;
  suite: Suite;
  target: EvalTarget;
  label?: string;
  /** محدودکردن به چند کیس اول — برای تست سریع و ارزان. */
  limit?: number;
  /** فیلتر بر اساس دسته. */
  categories?: string[];
  store: BlogStoreLike;
  /** برای گزارش پیشرفت در ترمینال. */
  onProgress?: (done: number, total: number, last: CaseResult) => void;
};

/** اجرای یک کیس: گفتگو را جلو می‌برد، بعد داورها را صدا می‌زند. */
async function runCase(
  c: EvalCase,
  target: EvalTarget
): Promise<{ result: Omit<CaseResult, "finalScore" | "verdict">; usage: Usage }> {
  const transcript: CaseResult["transcript"] = [];
  let conversationId: string | null = null;
  let lastText = "";
  let lastLatency = 0;
  let lastSources: CaseResult["sources"] = [];
  let error: string | undefined;

  // ── مرحله‌ی الف: گفتگو را نوبت‌به‌نوبت جلو می‌بریم ──
  // کیس‌های چندنوبتی (مثل مسیر ثبت لید) فقط اینجا با تک‌نوبتی‌ها
  // فرق دارند؛ بقیه‌ی سیستم تفاوتی نمی‌بیند.
  for (const turn of c.turns) {
    transcript.push({ role: "user", text: turn.user });
    const res = await target.send(turn.user, conversationId);

    if (res.error) {
      error = res.error;
      transcript.push({ role: "assistant", text: `(خطا: ${res.error})` });
      break;
    }

    conversationId = res.conversationId ?? conversationId;
    lastText = res.text;
    lastLatency = res.latencyMs;
    lastSources = res.sources ?? [];
    transcript.push({ role: "assistant", text: res.text });
  }

  const checks = runChecks(c, {
    text: lastText,
    latencyMs: lastLatency,
    sources: lastSources,
  });

  const usage: Usage = { in: 0, out: 0 };
  const add = (u: Usage) => {
    usage.in += u.in;
    usage.out += u.out;
  };

  const base = {
    caseId: c.id,
    category: c.category,
    question: c.turns[c.turns.length - 1].user,
    transcript,
    answer: lastText,
    latencyMs: lastLatency,
    sources: lastSources,
    checks,
    weight: c.weight,
    error,
  };

  // پاسخ خالی یا خطا → داور را صدا نمی‌زنیم. قضاوت‌کردن روی هیچ،
  // هم پول هدر دادن است هم نمره‌ی بی‌معنا تولید می‌کند.
  if (error || checks.empty) {
    return {
      result: {
        ...base,
        expectation: null,
        faithfulness: null,
        brandVoice: null,
        safety: null,
        judgeUsage: usage,
      },
      usage,
    };
  }

  const transcriptText = transcript
    .map((t) => `${t.role === "user" ? "کاربر" : "بات"}: ${t.text}`)
    .join("\n");

  // ── مرحله‌ی ب: چهار داور را موازی می‌زنیم ──
  // مستقل‌اند، پس دلیلی برای سریال‌بودن نیست. چهار برابر سریع‌تر.
  const [expectation, faithfulness, brandVoice, safety] = await Promise.all([
    judgeExpectation(c, lastText, transcriptText).then((r) => {
      add(r.usage);
      return r.data;
    }),
    // اگر هدف منابع را گزارش نکند، سنجش وفاداری بی‌معناست — ردش می‌کنیم.
    target.reportsSources
      ? judgeFaithfulness(c, lastText, lastSources).then((r) => {
          add(r.usage);
          return r.data;
        })
      : Promise.resolve(null),
    judgeBrandVoice(lastText).then((r) => {
      add(r.usage);
      return r.data;
    }),
    judgeSafety(c, lastText).then((r) => {
      add(r.usage);
      return r.data;
    }),
  ]);

  return {
    result: { ...base, expectation, faithfulness, brandVoice, safety, judgeUsage: usage },
    usage,
  };
}

/**
 * تخمین محافظه‌کارانه‌ی زمان یک کیس: فاصله‌ی throttle (۳٫۲ ثانیه) +
 * پاسخ بات (~۶ ثانیه، p95 حدود ۷٫۵) + چهار داور موازی (~۵ ثانیه).
 * اگر این‌قدر وقت تا پایان بودجه نمانده باشد، کیس بعدی را شروع
 * نمی‌کنیم — کیس نیمه‌کاره نه ذخیره می‌شود نه ارزشی دارد.
 */
const CASE_BUDGET_MS = 20_000;

/** فهرست کیس‌ها بعد از اعمال فیلتر دسته و سقف تعداد. */
function planCases(suite: Suite, opts: { limit?: number; categories?: string[] }): EvalCase[] {
  let cases = suite.cases;
  if (opts.categories?.length) {
    cases = cases.filter((c) => opts.categories!.includes(c.category));
  }
  if (opts.limit) cases = cases.slice(0, opts.limit);
  return cases;
}

/**
 * ساخت رکورد اجرا — بدون اجرای هیچ کیسی.
 *
 * چرا جدا از اجرا؟ چون درخواستی که کل ارزیابی را انجام می‌داد
 * روی سرورلس تایم‌اوت می‌خورد (سقف ۳۰۰ ثانیه، اجرای کامل ~۳۱۴ ثانیه).
 * حالا ساختِ اجرا یک عملیات آنی است و خودِ اجرا تکه‌تکه جلو می‌رود.
 */
export async function createRun(opts: RunOptions): Promise<EvalRun> {
  const { runId, suite, target, store } = opts;
  const cases = planCases(suite, opts);

  const run: EvalRun = {
    id: runId,
    status: "running",
    createdAt: new Date().toISOString(),
    suiteId: suite.id,
    suiteTitle: suite.title,
    targetId: target.id,
    targetLabel: target.label,
    judgeModel: judgeModelId(),
    label: opts.label || "",
    progress: { done: 0, total: cases.length, caseIds: cases.map((c) => c.id) },
    results: [],
    summary: null,
  };

  await store.saveRun(run);
  return run;
}

/** جمع مصرف داورها روی همه‌ی کیس‌های انجام‌شده — تا الان. */
function totalUsageOf(results: CaseResult[]): Usage {
  return results.reduce<Usage>(
    (a, r) => ({ in: a.in + (r.judgeUsage?.in ?? 0), out: a.out + (r.judgeUsage?.out ?? 0) }),
    { in: 0, out: 0 }
  );
}

export type AdvanceOptions = {
  run: EvalRun;
  suite: Suite;
  target: EvalTarget;
  store: BlogStoreLike;
  /**
   * سقف زمانی این تکه. وقتی تمام شد، اجرا نیمه‌کاره ذخیره می‌شود و
   * فراخوانی بعدی از همان‌جا ادامه می‌دهد. `Infinity` یعنی تا آخر برو
   * (حالت CLI، جایی که تایم‌اوتی در کار نیست).
   */
  budgetMs?: number;
  onProgress?: RunOptions["onProgress"];
};

/**
 * اجرا را تا جایی که بودجه‌ی زمانی اجازه می‌دهد جلو می‌برد.
 *
 * قابل ازسرگیری است: کیس‌هایی که نتیجه‌شان از قبل ثبت شده دوباره
 * اجرا نمی‌شوند. پس اگر یک تکه هم شکست بخورد، کار انجام‌شده از
 * دست نمی‌رود و فراخوانی بعدی ادامه می‌دهد.
 */
export async function advanceRun(opts: AdvanceOptions): Promise<EvalRun> {
  const { run, suite, target, store } = opts;
  const budgetMs = opts.budgetMs ?? Infinity;
  const deadline = Date.now() + budgetMs;

  // نقشه‌ی ذخیره‌شده مرجع است؛ اگر نبود (اجرای قدیمی)، کل مجموعه.
  const plan = run.progress.caseIds;
  const planned = plan ? suite.cases.filter((c) => plan.includes(c.id)) : suite.cases;

  const done = new Set(run.results.map((r) => r.caseId));
  const remaining = planned.filter((c) => !done.has(c.id));

  run.progress.total = planned.length;

  for (const c of remaining) {
    // پیش از شروع کیس بعدی چک می‌کنیم؛ کیس نیمه‌کاره فایده‌ای ندارد.
    // هر کیس ~۱۰ ثانیه طول می‌کشد (فاصله‌ی throttle + پاسخ بات + داورها).
    if (Date.now() + CASE_BUDGET_MS > deadline) {
      run.progress.done = run.results.length;
      await store.saveRun(run);
      return run;
    }

    try {
      const { result } = await runCase(c, target);
      const { finalScore, verdict } = computeFinalScore(result);
      const full: CaseResult = { ...result, finalScore, verdict };
      run.results.push(full);
      opts.onProgress?.(run.results.length, planned.length, full);
    } catch (e) {
      // یک کیس شکست‌خورده نباید کل اجرا را بخواباند. ثبتش می‌کنیم
      // و می‌رویم سراغ بعدی — گزارش ناقص از گزارش نداشتن بهتر است.
      const failed: CaseResult = {
        caseId: c.id,
        category: c.category,
        question: c.turns[c.turns.length - 1].user,
        transcript: [],
        answer: "",
        latencyMs: 0,
        sources: [],
        checks: runChecks(c, { text: "", latencyMs: 0, sources: [] }),
        expectation: null,
        faithfulness: null,
        brandVoice: null,
        safety: null,
        finalScore: 0,
        verdict: "fail",
        weight: c.weight,
        error: (e as Error).message,
      };
      run.results.push(failed);
      opts.onProgress?.(run.results.length, planned.length, failed);
    }

    // پیشرفت را بعد از هر کیس ذخیره می‌کنیم تا داشبورد بتواند
    // اجرای در جریان را زنده نشان بدهد (همان الگوی فاز ۳).
    run.progress.done = run.results.length;
    await store.saveRun(run);
  }

  const usage = totalUsageOf(run.results);
  run.summary = summarize(run.results, costUsd(run.judgeModel, usage), usage);
  run.status = "done";
  run.finishedAt = new Date().toISOString();
  await store.saveRun(run);

  return run;
}

/**
 * اجرای کامل در یک نشست — بدون سقف زمانی.
 * مسیر CLI (`npm run eval`) از این استفاده می‌کند، جایی که خبری از
 * تایم‌اوت سرورلس نیست.
 */
export async function runEvaluation(opts: RunOptions): Promise<EvalRun> {
  const run = await createRun(opts);
  return advanceRun({
    run,
    suite: opts.suite,
    target: opts.target,
    store: opts.store,
    onProgress: opts.onProgress,
  });
}
