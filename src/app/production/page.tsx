import type { Metadata } from "next";
import { channelLabel, getProductionStats } from "@/lib/production";
import { faNum, pct, relTime } from "@/lib/utils";
import { EmptyState, PageHeader, Stat, Teach } from "@/components/ui";

export const metadata: Metadata = { title: "پایش تولید" };
export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const stats = await getProductionStats(30);

  const teach = (
    <Teach>
      گلدن‌ست فقط چیزی را می‌سنجد که <strong>ما</strong> فکر کردیم مهم است. ترافیک واقعی چیزی
      را نشان می‌دهد که هرگز به ذهنمان نرسیده بود: کاربر واقعاً چه می‌پرسد و کجا بات کم می‌آورد.
      به همین دلیل فهرست «شکاف دانش» ارزشمندترین ورودیِ بهبود در کل این داشبورد است — هر ردیف
      آن یعنی کسی سؤالی پرسیده که هیچ سندی برایش وجود نداشته، و هر ردیف یک{" "}
      <strong>سند تازه برای پایگاه دانش</strong> است. بهبود واقعی از اینجا می‌آید، نه از
      دستکاری پرامپت.
    </Teach>
  );

  if (!stats.configured) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="پایش تولید"
          subtitle="لایه‌ی دوم ارزیابی — رفتار بات روی ترافیک واقعی، نه روی کیس‌های ساختگی."
        />
        <EmptyState
          title="اتصال به دیتابیس تولید تنظیم نشده است"
          description="برای دیدن این بخش باید ARKAN_SUPABASE_URL و ARKAN_SUPABASE_SERVICE_ROLE_KEY را در محیط تنظیم کنید. این بخش دیتابیس زنده‌ی چت‌بات آرکان را فقط می‌خواند و هرگز چیزی در آن نمی‌نویسد یا تغییر نمی‌دهد."
        />
        {teach}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="پایش تولید"
        subtitle={`پنجره‌ی ${faNum(stats.window.days)} روز گذشته — خواندنی از دیتابیس زنده‌ی چت‌بات آرکان.`}
      />

      {stats.error && (
        <div className="rounded-card bg-fail/10 p-4 text-sm text-fail">
          خطا در خواندن دیتابیس تولید: {stats.error}
        </div>
      )}

      {!stats.error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="گفتگوها" value={faNum(stats.totals.conversations)} />
            <Stat
              label="پیام‌ها"
              value={faNum(stats.totals.messages)}
              hint={`${faNum(stats.totals.assistantMessages)} پاسخ بات`}
            />
            <Stat
              label="لید از چت‌بات"
              value={faNum(stats.totals.chatbotLeads)}
              hint={`از مجموع ${faNum(stats.totals.leads)} لید`}
            />
            <Stat
              label="نرخ رضایت"
              value={stats.satisfaction.rate === null ? "—" : pct(stats.satisfaction.rate, 1)}
              hint={`${faNum(stats.satisfaction.up)} 👍 · ${faNum(stats.satisfaction.down)} 👎`}
              tone={
                stats.satisfaction.rate === null
                  ? "default"
                  : stats.satisfaction.rate >= 80
                    ? "pass"
                    : stats.satisfaction.rate >= 60
                      ? "partial"
                      : "fail"
              }
            />
            <Stat
              label="نرخ تبدیل"
              value={pct(stats.conversionRate, 1)}
              hint="گفتگو تا لید"
            />
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-heading font-semibold">تفکیک کانالی</h2>
            {stats.byChannel.length ? (
              <ul className="space-y-2">
                {stats.byChannel.map((c) => {
                  const share = stats.totals.conversations
                    ? (c.conversations / stats.totals.conversations) * 100
                    : 0;
                  return (
                    <li key={c.channel} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm">{channelLabel(c.channel)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-pine" style={{ width: `${share}%` }} />
                      </div>
                      <span className="tnum w-24 shrink-0 text-left text-sm">
                        {faNum(c.conversations)} <span className="text-xs text-slate">({pct(share)})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate">در این بازه گفتگویی ثبت نشده است.</p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* شکاف دانش — مهم‌ترین فهرست این صفحه */}
            <div className="card p-5">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="font-heading font-semibold">شکاف دانش</h2>
                <span className="tnum text-xs text-slate">{faNum(stats.knowledgeGaps.length)} مورد</span>
              </div>
              <p className="mb-4 text-xs leading-6 text-slate">
                سؤال‌هایی که بات بدون هیچ منبع بازیابی‌شده‌ای به آن‌ها پاسخ داده است.
              </p>
              {stats.knowledgeGaps.length ? (
                <ul className="space-y-2">
                  {stats.knowledgeGaps.map((g, i) => (
                    <li key={i} className="rounded-card border border-sand bg-white p-3">
                      <p className="text-sm leading-7">{g.question}</p>
                      <div className="mt-1 text-xs text-slate">{relTime(g.when)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate">
                  هیچ شکافی پیدا نشد — هر پاسخ دست‌کم یک منبع داشته است.
                </p>
              )}
            </div>

            {/* بازخورد منفی */}
            <div className="card p-5">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="font-heading font-semibold">بازخورد منفی</h2>
                <span className="tnum text-xs text-slate">
                  {faNum(stats.negativeFeedback.length)} مورد
                </span>
              </div>
              <p className="mb-4 text-xs leading-6 text-slate">
                پاسخ‌هایی که کاربر 👎 داده — قضاوت انسانِ واقعی، نه داورِ مدل.
              </p>
              {stats.negativeFeedback.length ? (
                <ul className="space-y-2">
                  {stats.negativeFeedback.map((f, i) => (
                    <li key={i} className="rounded-card border border-fail/30 bg-fail/5 p-3">
                      <p className="text-sm leading-7">{f.answer}</p>
                      {f.comment && (
                        <p className="mt-2 text-xs leading-6 text-fail">«{f.comment}»</p>
                      )}
                      <div className="mt-1 text-xs text-slate">{relTime(f.when)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate">در این بازه بازخورد منفی ثبت نشده است.</p>
              )}
            </div>
          </div>
        </>
      )}

      {teach}
    </div>
  );
}
