import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, ScoreBadge, Teach, VerdictBar } from "@/components/ui";
import { formatUsd } from "@/lib/pricing";
import { getStore } from "@/lib/store";
import { faNum, ms, relTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "اجراها" };

export default async function RunsPage() {
  const runs = await getStore().listRuns(30);

  if (!runs.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="اجراها" />
        <EmptyState
          title="هنوز اجرایی ثبت نشده"
          description="از صفحه‌ی نمای کلی یک ارزیابی شروع کنید، یا در ترمینال «npm run eval» را اجرا کنید."
          action={
            <Link href="/" className="btn-primary">
              رفتن به نمای کلی
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="اجراها"
        subtitle="تاریخچه‌ی ارزیابی‌ها. هر ردیف یک عکس لحظه‌ای از کیفیت بات در آن زمان است."
      />

      <div className="card overflow-x-auto thin-scroll">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-sand text-right text-xs text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">نمره</th>
              <th className="px-4 py-3 font-medium">برچسب</th>
              <th className="px-4 py-3 font-medium">ترکیب احکام</th>
              <th className="px-4 py-3 font-medium">کیس</th>
              <th className="px-4 py-3 font-medium">تأخیر</th>
              <th className="px-4 py-3 font-medium">هزینه‌ی داوری</th>
              <th className="px-4 py-3 font-medium">زمان</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-sand/60 last:border-0 hover:bg-sand/20">
                <td className="px-4 py-3">
                  {r.summary ? (
                    <Link href={`/runs/${r.id}`}>
                      <ScoreBadge score={r.summary.overallScore} size="sm" />
                    </Link>
                  ) : (
                    <span className="chip bg-sand text-slate">
                      {r.status === "running"
                        ? `${faNum(r.progress.done)}/${faNum(r.progress.total)}`
                        : "خطا"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/runs/${r.id}`} className="hover:text-brass hover:underline">
                    {r.label || r.suiteTitle}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.summary ? (
                    <div className="w-28">
                      <VerdictBar counts={r.summary.counts} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate">—</span>
                  )}
                </td>
                <td className="tnum px-4 py-3">{faNum(r.results?.length ?? r.progress.total)}</td>
                <td className="tnum px-4 py-3">
                  {r.summary ? ms(r.summary.latency.avgMs) : "—"}
                </td>
                <td className="tnum px-4 py-3">
                  {r.summary ? formatUsd(r.summary.judgeCostUsd) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate">{relTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Teach>
        یک اجرای تنها فقط می‌گوید «الان وضع این است». ارزش واقعی وقتی پیدا می‌شود که چند اجرا
        داشته باشید و بتوانید بگویید «بعد از آن تغییر، بهتر شد یا بدتر». برای همین به هر اجرا
        برچسب معنادار بدهید — مثلاً «بعد از اصلاح پرامپت ضدتوهم» — نه فقط تاریخ.
      </Teach>
    </div>
  );
}
