import type { EvalTarget, TargetResponse } from "../types";

/**
 * هدف ساختگی — پاسخ‌های از پیش ضبط‌شده.
 *
 * دو کاربرد:
 * ۱. دانشجو بدون هیچ کلید API و بدون بالا بودن چت‌بات، کل جریان را ببیند.
 * ۲. تست خودِ داور: اگر پاسخ‌های عمداً بد بدهیم، داور باید ردشان کند.
 *    این ساده‌ترین راه برای اعتبارسنجی داور است.
 */
export function createFixtureTarget(
  fixtures: Record<string, string>,
  label = "پاسخ‌های ضبط‌شده"
): EvalTarget {
  return {
    id: "fixture",
    label,
    reportsSources: false,

    async send(message): Promise<TargetResponse> {
      const key = Object.keys(fixtures).find((k) => message.includes(k));
      return {
        text: key ? fixtures[key] : "پاسخ ضبط‌شده‌ای برای این پیام موجود نیست.",
        latencyMs: 0,
        sources: [],
      };
    },
  } satisfies EvalTarget;
}
