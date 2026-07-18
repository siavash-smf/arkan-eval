import { z } from "zod";

/* ────────────────────────────────────────────────────────────
   قراردادهای پروژه.
   قاعده‌ی کلی: هر چیزی که از LLM بیرون می‌آید باید یک اسکیمای zod
   داشته باشد. هیچ خروجی مدلی بدون اعتبارسنجی وارد سیستم نمی‌شود.
   ──────────────────────────────────────────────────────────── */

/* ── ۱. مجموعه‌ی آزمون (Golden Set) ───────────────────────── */

/** یک نوبت گفتگو. برای کیس‌های چندمرحله‌ای (مثل مسیر ثبت لید) چند نوبت داریم. */
export const TurnSchema = z.object({
  user: z.string().min(1),
  /** اگر پر باشد، انتظار ما از همین نوبت است (نه از کل گفتگو). */
  expect: z.string().optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const CaseSchema = z.object({
  id: z.string().min(1),
  /** دسته‌ی کیس — مبنای تفکیک نمره در گزارش. */
  category: z.string().min(1),
  /** نوبت‌های گفتگو. تک‌نوبتی = آرایه‌ی یک‌عضوی. */
  turns: z.array(TurnSchema).min(1),
  /** رفتار درست مورد انتظار — ورودی اصلی داورِ انطباق. */
  expected: z.string().min(1),
  /** نشانه‌ی شکست — به داور می‌گوید دنبال چه چیزی بگردد. */
  failureSignal: z.string().min(1),
  /**
   * آیا انتظار داریم پاسخ از پایگاه دانش پشتیبانی شود؟
   * برای کیس‌های ضدتوهم false است — آنجا «نداشتن منبع» درست است، نه غلط.
   */
  groundedExpected: z.boolean().default(true),
  /** وزن کیس در نمره‌ی کل. کیس‌های ایمنی عمداً سنگین‌ترند. */
  weight: z.number().min(0).max(5).default(1),
});
export type EvalCase = z.infer<typeof CaseSchema>;

export const SuiteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  cases: z.array(CaseSchema).min(1),
});
export type Suite = z.infer<typeof SuiteSchema>;

/* ── ۲. هدف ارزیابی (Target) ──────────────────────────────── */

/** منبعی که چت‌بات برای پاسخ بازیابی کرده — از هدر x-arkan-meta می‌آید. */
export type RetrievedSource = {
  title: string;
  similarity: number;
  chunk_index: number;
};

export type TargetResponse = {
  text: string;
  latencyMs: number;
  /** شناسه‌ی گفتگو، برای ادامه‌دادن نوبت بعدی. */
  conversationId?: string | null;
  /** منابع بازیابی‌شده. اگر هدف این را ندهد، undefined می‌ماند. */
  sources?: RetrievedSource[];
  error?: string;
};

/** هر هدف ارزیابی این اینترفیس را پیاده می‌کند. الگوی Adapter. */
export interface EvalTarget {
  id: string;
  label: string;
  /** آیا این هدف منابع بازیابی را برمی‌گرداند؟ اگر نه، داور وفاداری رد می‌شود. */
  reportsSources: boolean;
  send(message: string, conversationId?: string | null): Promise<TargetResponse>;
}

/* ── ۳. خروجی داورها ──────────────────────────────────────── */

export const VERDICTS = ["pass", "partial", "fail"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "موفق",
  partial: "نسبی",
  fail: "ناموفق",
};

/** خروجی داورِ انطباق با انتظار — داور اصلی. */
export const ExpectationVerdictSchema = z.object({
  verdict: z.enum(VERDICTS),
  score: z.number().min(0).max(10),
  reasoning: z.string().min(1),
  /** آیا نشانه‌ی شکستِ اعلام‌شده در پاسخ دیده شد؟ */
  failureSignalPresent: z.boolean(),
});
export type ExpectationVerdict = z.infer<typeof ExpectationVerdictSchema>;

/** خروجی داورِ وفاداری به منبع — مهم‌ترین سنجه‌ی ضدتوهم. */
export const FaithfulnessVerdictSchema = z.object({
  score: z.number().min(0).max(10),
  /** ادعاهایی که در منابع پشتیبانی نمی‌شوند. خالی = وفادار. */
  unsupportedClaims: z.array(z.string()).default([]),
  /** آیا بات صادقانه گفته که نمی‌داند؟ برای کیس‌های ضدتوهم کلیدی است. */
  admittedUncertainty: z.boolean(),
  reasoning: z.string().min(1),
});
export type FaithfulnessVerdict = z.infer<typeof FaithfulnessVerdictSchema>;

/** خروجی داورِ لحن برند. */
export const BrandVoiceVerdictSchema = z.object({
  score: z.number().min(0).max(10),
  violations: z.array(z.string()).default([]),
  reasoning: z.string().min(1),
});
export type BrandVoiceVerdict = z.infer<typeof BrandVoiceVerdictSchema>;

/** خروجی داورِ ایمنی و گاردریل. */
export const SafetyVerdictSchema = z.object({
  score: z.number().min(0).max(10),
  /** آیا بات از نقشش خارج شد؟ */
  brokeCharacter: z.boolean(),
  /** آیا محتوای پرامپت داخلی فاش شد؟ */
  leakedPrompt: z.boolean(),
  /** آیا تعهد یا وعده‌ی بی‌مبنا داد؟ */
  unfoundedCommitment: z.boolean(),
  reasoning: z.string().min(1),
});
export type SafetyVerdict = z.infer<typeof SafetyVerdictSchema>;

/* ── ۴. بررسی‌های قطعی (بدون LLM) ─────────────────────────── */

/**
 * درسِ فاز ۳ اینجا هم اجرا می‌شود: کاری که کد می‌تواند قطعی انجام دهد
 * را به مدل نمی‌سپاریم. این‌ها ارزان، سریع و ۱۰۰٪ تکرارپذیرند.
 */
export type DeterministicChecks = {
  charCount: number;
  wordCount: number;
  /** تعداد علامت تعجب — برند گاید می‌گوید «علامت تعجب پشت‌سرهم» ممنوع. */
  exclamationCount: number;
  /** واژه‌های ممنوعه‌ی برند (تضمین، بی‌رقیب، ...) که پیدا شدند. */
  bannedPhrases: string[];
  /** آیا عبارتی شبیه نشت پرامپت داخلی دیده شد؟ */
  promptLeakSuspected: boolean;
  /** آیا پاسخ خالی یا خطا بود؟ */
  empty: boolean;
  /** تعداد منابع بازیابی‌شده. */
  sourceCount: number;
  /** بالاترین امتیاز شباهت میان منابع. */
  maxSimilarity: number | null;
  /**
   * آیا وضعیت بازیابی با انتظار کیس می‌خواند؟
   * groundedExpected=true و sourceCount=0 → ناهماهنگ (شکاف دانش).
   */
  retrievalMismatch: boolean;
};

/* ── ۵. نتیجه‌ی یک کیس ────────────────────────────────────── */

export type CaseResult = {
  caseId: string;
  category: string;
  /** آخرین پیام کاربر (برای نمایش در گزارش). */
  question: string;
  /** کل رونوشت گفتگو، برای کیس‌های چندنوبتی. */
  transcript: { role: "user" | "assistant"; text: string }[];
  answer: string;
  latencyMs: number;
  sources: RetrievedSource[];
  checks: DeterministicChecks;
  expectation: ExpectationVerdict | null;
  faithfulness: FaithfulnessVerdict | null;
  brandVoice: BrandVoiceVerdict | null;
  safety: SafetyVerdict | null;
  /** نمره‌ی نهایی ۰ تا ۱۰۰ — ترکیب وزنی داورها. */
  finalScore: number;
  verdict: Verdict;
  weight: number;
  error?: string;
};

/* ── ۶. یک اجرای کامل ─────────────────────────────────────── */

export type RunStatus = "running" | "done" | "error";

export type RunSummary = {
  /** نمره‌ی کل ۰ تا ۱۰۰، وزن‌دار. */
  overallScore: number;
  counts: Record<Verdict, number>;
  byCategory: {
    category: string;
    score: number;
    counts: Record<Verdict, number>;
  }[];
  /** میانگین نمره‌ی هر بُعد. */
  dimensions: {
    expectation: number | null;
    faithfulness: number | null;
    brandVoice: number | null;
    safety: number | null;
  };
  latency: { avgMs: number; p95Ms: number; maxMs: number };
  /** هزینه‌ی داوری (نه هزینه‌ی خود چت‌بات — آن سمت ما نیست). */
  judgeCostUsd: number;
  judgeTokens: { in: number; out: number };
  /** کیس‌هایی که انتظار منبع داشتند ولی چیزی بازیابی نشد. */
  knowledgeGaps: number;
};

export type EvalRun = {
  id: string;
  status: RunStatus;
  createdAt: string;
  finishedAt?: string | null;
  suiteId: string;
  suiteTitle: string;
  targetId: string;
  targetLabel: string;
  judgeModel: string;
  /** برچسب دلخواه کاربر — مثلاً «بعد از اصلاح پرامپت». */
  label: string;
  /** پیشرفت زنده: چند کیس از چند کیس. */
  progress: { done: number; total: number };
  results: CaseResult[];
  summary: RunSummary | null;
  error?: string | null;
};

/* ── ۷. متا-ارزیابی داور ──────────────────────────────────── */

/**
 * برچسب انسانی روی یک نتیجه. با این‌ها می‌سنجیم که خودِ داور
 * چقدر با قضاوت انسان هم‌خوان است — «چه کسی داور را داوری می‌کند؟»
 */
export type HumanLabel = {
  id: string;
  runId: string;
  caseId: string;
  humanVerdict: Verdict;
  judgeVerdict: Verdict;
  note: string;
  createdAt: string;
};

export type JudgeAlignment = {
  total: number;
  agreed: number;
  agreementRate: number;
  /** ماتریس درهم‌ریختگی: [انسان][داور] */
  matrix: Record<Verdict, Record<Verdict, number>>;
  /** ضریب کاپای کوهن — هم‌خوانی فراتر از شانس. */
  cohensKappa: number | null;
};
