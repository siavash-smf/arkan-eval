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
      result: { ...base, expectation: null, faithfulness: null, brandVoice: null, safety: null },
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
    result: { ...base, expectation, faithfulness, brandVoice, safety },
    usage,
  };
}

export async function runEvaluation(opts: RunOptions): Promise<EvalRun> {
  const { runId, suite, target, store } = opts;

  let cases = suite.cases;
  if (opts.categories?.length) {
    cases = cases.filter((c) => opts.categories!.includes(c.category));
  }
  if (opts.limit) cases = cases.slice(0, opts.limit);

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
    progress: { done: 0, total: cases.length },
    results: [],
    summary: null,
  };

  await store.saveRun(run);

  const totalUsage: Usage = { in: 0, out: 0 };

  for (const c of cases) {
    try {
      const { result, usage } = await runCase(c, target);
      totalUsage.in += usage.in;
      totalUsage.out += usage.out;

      const { finalScore, verdict } = computeFinalScore(result);
      const full: CaseResult = { ...result, finalScore, verdict };
      run.results.push(full);
      opts.onProgress?.(run.results.length, cases.length, full);
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
      opts.onProgress?.(run.results.length, cases.length, failed);
    }

    // پیشرفت را بعد از هر کیس ذخیره می‌کنیم تا داشبورد بتواند
    // اجرای در جریان را زنده نشان بدهد (همان الگوی فاز ۳).
    run.progress.done = run.results.length;
    await store.saveRun(run);
  }

  run.summary = summarize(run.results, costUsd(run.judgeModel, totalUsage), totalUsage);
  run.status = "done";
  run.finishedAt = new Date().toISOString();
  await store.saveRun(run);

  return run;
}
