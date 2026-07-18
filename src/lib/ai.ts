import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type { z } from "zod";

/* ────────────────────────────────────────────────────────────
   لایه‌ی مدل — بازاستفاده از الگوی فازهای قبلی آرکان.
   دو تفاوت مهم با فازهای قبل:
   ۱. اینجا دما را روی ۰ می‌گذاریم. داور باید تا حد ممکن تکرارپذیر
      باشد؛ خلاقیت در داوری یعنی نویز در اندازه‌گیری.
   ۲. مصرف توکن را برمی‌گردانیم، چون هزینه‌ی داوری خودش یکی از
      سنجه‌های داشبورد است.
   ──────────────────────────────────────────────────────────── */

export function isConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function judgeModelId(): string {
  return process.env.JUDGE_MODEL || "google/gemini-2.5-flash";
}

function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY تنظیم نشده است.");

  return createOpenAICompatible({
    name: "openrouter",
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      "HTTP-Referer": "https://github.com/siavash-smf/arkan-eval",
      "X-Title": "Arkan Eval",
    },
    // درسِ فاز ۲: مدل‌های Gemini استدلال اجباری دارند و اگر جلویشان را
    // نگیریم کل بودجه‌ی توکن را صرف reasoning می‌کنند و خروجی خالی می‌دهند.
    // این wrapper همان اصلاح است و نباید حذف شود.
    fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          body.reasoning = { effort: "low" };
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          // اگر بدنه JSON نبود، دست‌نخورده رد می‌شود.
        }
      }
      return fetch(url, init);
    }) as typeof fetch,
  });
}

export type Usage = { in: number; out: number };

export type JudgeCall<T> = {
  data: T;
  usage: Usage;
  /** چند تلاش طول کشید تا خروجی معتبر شد. برای دیباگ داور. */
  attempts: number;
};

/** حذف حصار کد و برش دقیق آبجکت JSON از متن مدل. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw.trim();
  return raw.slice(start, end + 1);
}

/**
 * فراخوانی داور با خروجی ساختاریافته.
 *
 * چرا generateObject نه؟ همان دلیل فاز ۳: پشتیبانی مدل‌های مختلف
 * OpenRouter از JSON mode یکدست نیست. الگوی «بخواه → استخراج کن →
 * با zod اعتبارسنجی کن → در صورت خطا با پیام خطا دوباره بپرس»
 * روی همه‌ی مدل‌ها کار می‌کند و خطایش هم قابل‌دیدن است.
 */
export async function judgeJSON<T>(opts: {
  system: string;
  prompt: string;
  // ورودی و خروجی اسکیما عمداً یکی فرض نشده‌اند: فیلدهایی که
  // `.default([])` دارند در ورودی اختیاری‌اند ولی در خروجی حتماً هستند.
  // پارامتر سوم را `any` می‌گذاریم تا همین تفاوت مجاز بماند.
  schema: z.ZodType<T, z.ZodTypeDef, any>;
  shapeHint: string;
  maxOutputTokens?: number;
}): Promise<JudgeCall<T>> {
  const model = getOpenRouter()(judgeModelId());
  const usage: Usage = { in: 0, out: 0 };
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt =
      attempt === 1
        ? `${opts.prompt}\n\nفقط و فقط یک آبجکت JSON معتبر با این ساختار برگردان، بدون هیچ توضیح اضافه:\n${opts.shapeHint}`
        : `${opts.prompt}\n\nتلاش قبلی نامعتبر بود. خطا: ${lastError}\nاین بار فقط JSON معتبر با این ساختار بده:\n${opts.shapeHint}`;

    const res = await generateText({
      model,
      system: opts.system,
      prompt,
      temperature: 0, // داور باید تکرارپذیر باشد
      // سقف بالا چون مدل‌های استدلالی حتی با effort=low بخشی از بودجه را می‌خورند.
      maxOutputTokens: opts.maxOutputTokens ?? 2000,
    });

    usage.in += res.usage?.inputTokens ?? 0;
    usage.out += res.usage?.outputTokens ?? 0;

    try {
      const parsed = JSON.parse(extractJson(res.text));
      return { data: opts.schema.parse(parsed), usage, attempts: attempt };
    } catch (e) {
      lastError = (e as Error).message.slice(0, 300);
    }
  }

  throw new Error(`داور نتوانست خروجی معتبر بدهد. آخرین خطا: ${lastError}`);
}
