import type { Usage } from "./ai";

/**
 * قیمت تقریبی مدل‌ها — دلار به ازای هر ۱ میلیون توکن.
 * هم‌راستا با جدول قیمت فاز ۴ (src/lib/rag/analytics.ts) نگه داشته شود.
 */
export const PRICES: Record<string, { in: number; out: number }> = {
  "google/gemini-3.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-3.1-flash-lite": { in: 0.1, out: 0.4 },
  "anthropic/claude-haiku-4.5": { in: 1.0, out: 5.0 },
  "openai/gpt-5-mini": { in: 0.25, out: 2.0 },
  "openai/gpt-5.4-nano": { in: 0.1, out: 0.4 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "qwen/qwen3-30b-a3b-instruct-2507": { in: 0.1, out: 0.4 },
};

const DEFAULT_PRICE = { in: 0.5, out: 1.5 };

export function priceOf(model: string) {
  return PRICES[model] ?? DEFAULT_PRICE;
}

export function costUsd(model: string, usage: Usage): number {
  const p = priceOf(model);
  return (usage.in / 1_000_000) * p.in + (usage.out / 1_000_000) * p.out;
}

/** فرمت دلاری با دقت مناسب اعداد ریز. */
export function formatUsd(v: number): string {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
