import { isConfigured } from "@/lib/ai";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { advanceRun } from "@/lib/runner";
import { getStore } from "@/lib/store";
import { getSuite } from "@/lib/suites";
import { resolveTarget } from "@/lib/targets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * سقف تابع، با فاصله‌ی زیاد از بودجه‌ی تکه.
 *
 * چرا این‌قدر فاصله؟ چون کیس‌های چندنوبتی (مثل مسیر ثبت لید) دو تا
 * سه برابر کیس تک‌نوبتی طول می‌کشند. اگر یکی از آن‌ها درست لبه‌ی
 * بودجه شروع شود، باز هم وقت تمام‌کردنش هست.
 */
export const maxDuration = 180;

/**
 * بودجه‌ی هر تکه. با ~۱۲ ثانیه به‌ازای هر کیس، هر بار حدود ۶ کیس
 * پیش می‌رویم و کل گلدن‌ست ۳۲تایی در ~۶ تکه تمام می‌شود.
 *
 * این عدد را می‌شود بالا برد تا رفت‌وبرگشت کمتر شود، ولی هرچه تکه
 * بلندتر باشد، شکست یک تکه هم گران‌تر تمام می‌شود. ۹۰ ثانیه تعادل
 * خوبی است بین سربار و ریسک.
 */
const CHUNK_BUDGET_MS = 90_000;

/**
 * یک تکه از اجرا را جلو می‌برد.
 *
 * کلاینت این مسیر را پشت‌سرهم صدا می‌زند تا وقتی status برابر done شود.
 * چرا اینطور؟ چون اجرای کامل ~۳۱۴ ثانیه است و هیچ درخواست HTTP روی
 * سرورلس این‌قدر زنده نمی‌ماند. شکستن کار به تکه‌های کوتاه، هم مسئله‌ی
 * تایم‌اوت را حل می‌کند و هم اجرا را «ازسرگیری‌پذیر» می‌کند: اگر یک
 * تکه شکست بخورد، کیس‌های انجام‌شده در دیتابیس مانده‌اند و تکه‌ی بعدی
 * از همان‌جا ادامه می‌دهد.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) return unauthorized();

  if (!isConfigured()) {
    return Response.json(
      { error: "OPENROUTER_API_KEY تنظیم نشده است؛ داور نمی‌تواند کار کند." },
      { status: 500 }
    );
  }

  const store = getStore();
  const run = await store.getRun(params.id);
  if (!run) return Response.json({ error: "اجرا پیدا نشد." }, { status: 404 });

  // کار تمام است — بی‌سروصدا همان را برمی‌گردانیم تا کلاینت حلقه را ببندد.
  if (run.status !== "running") return Response.json({ run, finished: true });

  const suite = await getSuite(run.suiteId);
  if (!suite) {
    return Response.json({ error: `مجموعه‌ی «${run.suiteId}» پیدا نشد.` }, { status: 404 });
  }

  try {
    const updated = await advanceRun({
      run,
      suite,
      target: resolveTarget(run.targetId),
      store,
      budgetMs: CHUNK_BUDGET_MS,
    });
    return Response.json({ run: updated, finished: updated.status !== "running" });
  } catch (e) {
    // خطای کل تکه (نه یک کیس) — اجرا را خراب علامت می‌زنیم تا کلاینت
    // بی‌نهایت تلاش نکند. نتایج تا این لحظه ذخیره‌شده باقی می‌مانند.
    run.status = "error";
    run.error = (e as Error).message;
    run.finishedAt = new Date().toISOString();
    await store.saveRun(run).catch(() => {});
    return Response.json({ error: run.error }, { status: 500 });
  }
}
