import { z } from "zod";
import { isConfigured } from "@/lib/ai";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { runEvaluation } from "@/lib/runner";
import { getStore } from "@/lib/store";
import { getSuite } from "@/lib/suites";
import { resolveTarget } from "@/lib/targets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * ارزیابی کامل می‌تواند چند دقیقه طول بکشد (throttle هدف + ۴ داور در هر کیس).
 * سقف را روی حداکثر مجاز Vercel می‌گذاریم. برای گلدن‌ست بزرگ‌تر باید
 * به اجرای پس‌زمینه‌ای (queue) منتقل شود.
 */
export const maxDuration = 300;

const BodySchema = z.object({
  runId: z.string().uuid(),
  suiteId: z.string().min(1),
  targetId: z.string().min(1).default("http-chat"),
  label: z.string().max(120).default(""),
  limit: z.number().int().positive().max(200).optional(),
  categories: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();

  if (!isConfigured()) {
    return Response.json(
      { error: "OPENROUTER_API_KEY تنظیم نشده است؛ داور نمی‌تواند کار کند." },
      { status: 500 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return Response.json({ error: `ورودی نامعتبر: ${(e as Error).message}` }, { status: 400 });
  }

  const suite = await getSuite(body.suiteId);
  if (!suite) {
    return Response.json({ error: `مجموعه‌ی «${body.suiteId}» پیدا نشد.` }, { status: 404 });
  }

  try {
    // کلاینت runId را خودش می‌سازد و بلافاصله شروع به poll کردن می‌کند،
    // پس حتی اگر این درخواست timeout بخورد، پیشرفت قابل دیدن است.
    const run = await runEvaluation({
      runId: body.runId,
      suite,
      target: resolveTarget(body.targetId),
      label: body.label,
      limit: body.limit,
      categories: body.categories,
      store: getStore(),
    });
    return Response.json({ run });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
