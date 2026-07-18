import type { EvalTarget, RetrievedSource, TargetResponse } from "../types";

/**
 * هدف: یک چت‌بات واقعی پشت HTTP.
 *
 * این آداپتور مخصوص قرارداد چت‌بات آرکان (فاز ۲) نوشته شده:
 *   درخواست: POST { message, conversationId, channel }
 *   پاسخ:    بدنه = متن استریم‌شده
 *            هدر x-arkan-meta = base64 از { conversationId, sources }
 *
 * برای هر چت‌بات دیگری فقط همین فایل را کپی و تطبیق می‌دهید؛
 * بقیه‌ی سیستم دست نمی‌خورد. این کل هدفِ الگوی Adapter است.
 */

/**
 * چت‌بات آرکان روی هر IP سقف ۲۰ درخواست در ۶۰ ثانیه دارد.
 * اگر بدون فاصله بزنیم، از کیس ۲۱ به بعد همه ۴۲۹ می‌گیرند و
 * گزارش ارزیابی دروغ می‌شود — بات سالم است ولی ما خفه‌اش کرده‌ایم.
 * پس عمداً کند می‌زنیم. این یک تصمیم درست است، نه یک کندی تصادفی.
 */
const MIN_GAP_MS = 3200;
let lastCallAt = 0;

async function throttle() {
  const wait = lastCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

function parseMeta(headerValue: string | null): {
  conversationId: string | null;
  sources: RetrievedSource[];
} {
  if (!headerValue) return { conversationId: null, sources: [] };
  try {
    const json = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8"));
    return {
      conversationId: json.conversationId ?? null,
      sources: Array.isArray(json.sources) ? json.sources : [],
    };
  } catch {
    return { conversationId: null, sources: [] };
  }
}

export function createHttpChatTarget(opts?: {
  url?: string;
  channel?: string;
  label?: string;
}): EvalTarget {
  const url = opts?.url || process.env.TARGET_CHAT_URL || "";
  const channel = opts?.channel || "web";

  return {
    id: "http-chat",
    label: opts?.label || `چت‌بات آرکان (${channel})`,
    reportsSources: true,

    async send(message, conversationId) {
      if (!url) {
        return {
          text: "",
          latencyMs: 0,
          error: "TARGET_CHAT_URL تنظیم نشده است.",
        };
      }

      await throttle();
      const started = Date.now();

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, conversationId: conversationId ?? null, channel }),
          signal: AbortSignal.timeout(90_000),
        });

        const text = await res.text();
        const latencyMs = Date.now() - started;

        if (!res.ok) {
          return {
            text: "",
            latencyMs,
            error: `هدف کد ${res.status} برگرداند: ${text.slice(0, 200)}`,
          };
        }

        const meta = parseMeta(res.headers.get("x-arkan-meta"));
        return {
          text: text.trim(),
          latencyMs,
          conversationId: meta.conversationId,
          sources: meta.sources,
        };
      } catch (e) {
        return {
          text: "",
          latencyMs: Date.now() - started,
          error: `خطای شبکه: ${(e as Error).message}`,
        };
      }
    },
  } satisfies EvalTarget;
}
