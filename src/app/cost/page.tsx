import type { Metadata } from "next";
import { getProductionStats } from "@/lib/production";
import { getStore } from "@/lib/store";
import { PRICES, formatUsd } from "@/lib/pricing";
import { faNum, ms } from "@/lib/utils";
import { PageHeader, Stat, Teach } from "@/components/ui";

export const metadata: Metadata = { title: "هزینه و تأخیر" };
export const dynamic = "force-dynamic";

export default async function CostPage() {
  const [stats, runs] = await Promise.all([getProductionStats(30), getStore().listRuns(30)]);

  // هزینه‌ی داوری در همه‌ی اجراهای اخیر — این هزینه‌ی «سنجیدن» است، نه «کارکردن».
  const judgeCostUsd = runs.reduce((a, r) => a + (r.summary?.judgeCostUsd ?? 0), 0);
  const judgeTokens = runs.reduce(
    (a, r) => a + (r.summary ? r.summary.judgeTokens.in + r.summary.judgeTokens.out : 0),
    0
  );
  const judgedRuns = runs.filter((r) => r.summary).length;

  // تأخیر را از تازه‌ترین اجرای کامل می‌گیریم؛ میانگین‌گرفتن روی اجراهای
  // مختلف با هدف‌های مختلف عدد بی‌معنایی می‌سازد.
  const latest = runs.find((r) => r.status === "done" && r.summary);
  const latency = latest?.summary?.latency ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="هزینه و تأخیر"
        subtitle="کیفیت بدون هزینه و سرعت، نصفِ ماجراست. اینجا هر دو سرِ معادله را می‌بینیم."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="هزینه‌ی تولید"
          value={stats.configured && !stats.error ? formatUsd(stats.cost.totalUsd) : "—"}
          hint={
            stats.configured && !stats.error
              ? `${faNum(stats.cost.totalTokens)} توکن در ${faNum(stats.window.days)} روز`
              : "دیتابیس تولید تنظیم نشده"
          }
        />
        <Stat
          label="هزینه به‌ازای هر لید"
          value={
            stats.cost.costPerLeadUsd !== null ? formatUsd(stats.cost.costPerLeadUsd) : "—"
          }
          hint="عدد نهاییِ مورد علاقه‌ی کارفرما"
          tone={stats.cost.costPerLeadUsd !== null ? "pass" : "default"}
        />
        <Stat
          label="هزینه‌ی داوری"
          value={formatUsd(judgeCostUsd)}
          hint={`${faNum(judgeTokens)} توکن در ${faNum(judgedRuns)} اجرا`}
        />
        <Stat
          label="تأخیر پاسخ بات"
          value={latency ? ms(latency.avgMs) : "—"}
          hint={
            latency
              ? `p95: ${ms(latency.p95Ms)} · بیشینه: ${ms(latency.maxMs)}`
              : "هنوز اجرای کاملی ثبت نشده"
          }
        />
      </div>

      {stats.configured && stats.error && (
        <div className="rounded-card bg-fail/10 p-4 text-sm text-fail">
          خطا در خواندن دیتابیس تولید: {stats.error}
        </div>
      )}

      {/* ── هزینه به تفکیک مدل ── */}
      <div className="card overflow-hidden">
        <div className="border-b border-sand px-5 py-3">
          <h2 className="font-heading font-semibold">هزینه‌ی تولید به تفکیک مدل</h2>
          <p className="mt-1 text-xs text-slate">
            بر اساس توکن‌های ثبت‌شده در جدول پیام‌های چت‌بات، مرتب‌شده بر حسب هزینه.
          </p>
        </div>
        {stats.cost.byModel.length ? (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[40rem] text-right text-sm">
              <thead className="bg-bone/60 text-xs text-slate">
                <tr>
                  <th className="px-4 py-2 font-medium">مدل</th>
                  <th className="px-4 py-2 font-medium">پیام</th>
                  <th className="px-4 py-2 font-medium">توکن ورودی</th>
                  <th className="px-4 py-2 font-medium">توکن خروجی</th>
                  <th className="px-4 py-2 font-medium">هزینه</th>
                </tr>
              </thead>
              <tbody>
                {stats.cost.byModel.map((m) => (
                  <tr key={m.model} className="border-t border-sand/70">
                    <td className="px-4 py-3">
                      <code className="text-xs">{m.model}</code>
                    </td>
                    <td className="tnum px-4 py-3">{faNum(m.messages)}</td>
                    <td className="tnum px-4 py-3">{faNum(m.tokensIn)}</td>
                    <td className="tnum px-4 py-3">{faNum(m.tokensOut)}</td>
                    <td className="tnum px-4 py-3 font-medium">{formatUsd(m.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-sand bg-bone/60 text-sm font-medium">
                <tr>
                  <td className="px-4 py-3">مجموع</td>
                  <td className="tnum px-4 py-3">
                    {faNum(stats.cost.byModel.reduce((a, m) => a + m.messages, 0))}
                  </td>
                  <td className="tnum px-4 py-3">
                    {faNum(stats.cost.byModel.reduce((a, m) => a + m.tokensIn, 0))}
                  </td>
                  <td className="tnum px-4 py-3">
                    {faNum(stats.cost.byModel.reduce((a, m) => a + m.tokensOut, 0))}
                  </td>
                  <td className="tnum px-4 py-3">{formatUsd(stats.cost.totalUsd)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate">
            {stats.configured
              ? "داده‌ی مصرفی در این بازه ثبت نشده است."
              : "برای دیدن هزینه‌ی تولید، ARKAN_SUPABASE_URL و ARKAN_SUPABASE_SERVICE_ROLE_KEY را تنظیم کنید."}
          </p>
        )}
      </div>

      {/* ── جدول قیمت مرجع ── */}
      <div className="card overflow-hidden">
        <div className="border-b border-sand px-5 py-3">
          <h2 className="font-heading font-semibold">جدول قیمت مرجع</h2>
          <p className="mt-1 text-xs text-slate">
            دلار به‌ازای هر یک میلیون توکن — دستی در{" "}
            <code className="text-ink">src/lib/pricing.ts</code> نگه‌داری می‌شود.
          </p>
        </div>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[32rem] text-right text-sm">
            <thead className="bg-bone/60 text-xs text-slate">
              <tr>
                <th className="px-4 py-2 font-medium">مدل</th>
                <th className="px-4 py-2 font-medium">ورودی</th>
                <th className="px-4 py-2 font-medium">خروجی</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PRICES).map(([model, p]) => (
                <tr key={model} className="border-t border-sand/70">
                  <td className="px-4 py-2">
                    <code className="text-xs">{model}</code>
                  </td>
                  <td className="tnum px-4 py-2">${faNum(p.in)}</td>
                  <td className="tnum px-4 py-2">${faNum(p.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Teach>
        اینجا دو هزینه‌ی متفاوت وجود دارد که مدام با هم اشتباه گرفته می‌شوند: هزینه‌ی{" "}
        <strong>کارکردنِ</strong> بات (هر پاسخی که به کاربر واقعی می‌دهد) و هزینه‌ی{" "}
        <strong>سنجیدنِ</strong> بات (هر بار که داور مدلی کیس‌ها را نمره می‌دهد). هر دو واقعی‌اند
        و از یک کیف پول پرداخت می‌شوند؛ اگر فقط اولی را ببینید، ارزیابی «رایگان» به‌نظر می‌رسد و
        بی‌محابا اجرا می‌شود، و اگر فقط دومی را ببینید، بهینه‌سازیِ اشتباهی را دنبال می‌کنید.
        ضمناً جدول قیمت بالا یک <strong>تخمین دستی</strong> است، نه صورتحساب: در{" "}
        <code className="mx-1 text-ink">src/lib/pricing.ts</code> نوشته شده و باید با جدول
        قیمت فاز ۴ هم‌گام بماند. اگر قیمت‌ها کهنه شوند، همه‌ی اعداد این صفحه بی‌سروصدا غلط
        می‌شوند.
      </Teach>
    </div>
  );
}
