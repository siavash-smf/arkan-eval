import Link from "next/link";
import { RunLauncher } from "@/components/RunLauncher";
import { EmptyState, NavCard, PageHeader, ScoreBadge, Stat, Teach, VerdictBar } from "@/components/ui";
import { judgeModelId, isConfigured } from "@/lib/ai";
import { authEnabled } from "@/lib/auth";
import { formatUsd } from "@/lib/pricing";
import { getStore, storeKind } from "@/lib/store";
import { listSuites } from "@/lib/suites";
import { faNum, ms, relTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [suites, runs] = await Promise.all([listSuites(), getStore().listRuns(6)]);
  const latest = runs.find((r) => r.status === "done" && r.summary) ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="نمای کلی"
        subtitle="سنجش خودکار چت‌بات با داور هوش مصنوعی، پایش ترافیک واقعی، و کنترل هزینه."
      />

      {/* ── هشدارهای پیکربندی ── */}
      {!isConfigured() && (
        <div className="rounded-card bg-fail/10 p-4 text-sm text-fail">
          <strong>OPENROUTER_API_KEY تنظیم نشده است.</strong> بدون آن داور نمی‌تواند کار کند.
          فایل <code>.env.local.example</code> را به <code>.env.local</code> کپی کنید.
        </div>
      )}
      {!authEnabled() && (
        <div className="rounded-card bg-fail/10 p-4 text-sm text-fail">
          <strong>EVAL_PASSWORD تنظیم نشده — داشبورد کاملاً باز است.</strong> برای توسعه‌ی
          محلی مشکلی ندارد، ولی روی اینترنت عمومی یعنی هر کسی می‌تواند با کلید OpenRouter
          شما ارزیابی اجرا کند و هزینه بسازد.
        </div>
      )}

      {storeKind() === "memory" && (
        <div className="rounded-card border border-brass/30 bg-brass/5 p-4 text-sm">
          نتایج روی <strong>حافظه</strong> ذخیره می‌شوند و با ری‌استارت سرور پاک خواهند شد.
          برای ماندگاری، <code>supabase/schema.sql</code> را اجرا کنید و دو متغیر Supabase را
          در <code>.env.local</code> بگذارید.
        </div>
      )}

      {/* ── آخرین اجرا ── */}
      {latest?.summary ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="font-heading text-lg font-semibold">آخرین ارزیابی</h2>
            <Link href={`/runs/${latest.id}`} className="text-sm text-brass hover:underline">
              مشاهده‌ی گزارش کامل ←
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="نمره‌ی کل"
              value={`${faNum(latest.summary.overallScore)}/۱۰۰`}
              tone={
                latest.summary.overallScore >= 80
                  ? "pass"
                  : latest.summary.overallScore >= 60
                    ? "partial"
                    : "fail"
              }
              hint={latest.label || relTime(latest.createdAt)}
            />
            <Stat
              label="ناموفق"
              value={faNum(latest.summary.counts.fail)}
              tone={latest.summary.counts.fail > 0 ? "fail" : "pass"}
              hint={`از ${faNum(latest.results.length)} کیس`}
            />
            <Stat
              label="شکاف دانش"
              value={faNum(latest.summary.knowledgeGaps)}
              tone={latest.summary.knowledgeGaps > 0 ? "partial" : "pass"}
              hint="کیس بدون منبع بازیابی‌شده"
            />
            <Stat
              label="تأخیر میانگین"
              value={ms(latest.summary.latency.avgMs)}
              hint={`p95: ${ms(latest.summary.latency.p95Ms)}`}
            />
          </div>
        </section>
      ) : (
        <EmptyState
          title="هنوز ارزیابی‌ای اجرا نشده"
          description="با فرم پایین اولین ارزیابی را شروع کنید، یا از ترمینال «npm run eval» را بزنید."
        />
      )}

      {/* ── اجرای جدید ── */}
      <RunLauncher
        suites={suites.map((s) => ({
          id: s.id,
          title: s.title,
          caseCount: s.cases.length,
          categories: Array.from(new Set(s.cases.map((c) => c.category))),
        }))}
      />

      {/* ── تاریخچه ── */}
      {runs.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">اجراهای اخیر</h2>
          <div className="space-y-2">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="card flex flex-wrap items-center gap-3 p-3 transition-colors hover:border-brass/50"
              >
                {r.summary ? (
                  <ScoreBadge score={r.summary.overallScore} size="sm" />
                ) : (
                  <span className="chip bg-sand text-slate">
                    {r.status === "running"
                      ? `${faNum(r.progress.done)}/${faNum(r.progress.total)}`
                      : "خطا"}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">
                  {r.label || r.suiteTitle}
                </span>
                {r.summary && (
                  <div className="w-28 shrink-0">
                    <VerdictBar counts={r.summary.counts} />
                  </div>
                )}
                <span className="shrink-0 text-xs text-slate">{relTime(r.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── راهنمای بخش‌ها ── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">بخش‌های داشبورد</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <NavCard
            href="/suites"
            title="مجموعه‌ی آزمون"
            description="خط‌کش ثابت — کیس‌هایی که بعد از هر تغییر دوباره اجرا می‌شوند."
          />
          <NavCard
            href="/production"
            title="پایش تولید"
            description="ترافیک واقعی کاربران: رضایت، شکاف دانش، نرخ تبدیل."
          />
          <NavCard
            href="/cost"
            title="هزینه و تأخیر"
            description="هزینه‌ی اجرای بات، هزینه‌ی سنجش آن، و زمان پاسخ."
          />
          <NavCard
            href="/judge"
            title="داورِ داور"
            description="آیا داور هوش مصنوعی با قضاوت انسان هم‌خوان است؟"
          />
        </div>
      </section>

      <Teach>
        ارزیابی دو لایه دارد و هیچ‌کدام به‌تنهایی کافی نیست. <strong>مجموعه‌ی آزمون</strong> یک
        خط‌کش ثابت است: بعد از هر تغییر در پرامپت، مدل یا دانش دوباره اجرا می‌شود تا بفهمیم
        بهتر شد یا بدتر. <strong>پایش تولید</strong> چیزی را نشان می‌دهد که هیچ مجموعه‌ی
        آزمونی پیش‌بینی نمی‌کند — اینکه کاربران واقعی چه می‌پرسند و کجا بات کم می‌آورد.
        داور فعلی: <code>{judgeModelId()}</code>.
      </Teach>
    </div>
  );
}
