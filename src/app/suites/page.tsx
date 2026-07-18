import type { Metadata } from "next";
import { listSuites } from "@/lib/suites";
import type { EvalCase, Suite } from "@/lib/types";
import { faNum } from "@/lib/utils";
import { EmptyState, PageHeader, Teach } from "@/components/ui";

export const metadata: Metadata = { title: "مجموعه‌ی آزمون" };
export const dynamic = "force-dynamic";

export default async function SuitesPage() {
  const suites = await listSuites();

  return (
    <div className="space-y-6">
      <PageHeader
        title="مجموعه‌ی آزمون"
        subtitle="گلدن‌ست — کیس‌هایی که تعریف می‌کنند «درست» یعنی چه. هر اجرا دقیقاً همین‌ها را می‌سنجد."
      />

      <Teach>
        این کیس‌ها در پوشه‌ی <code className="mx-1 text-ink">suites/</code> به‌صورت JSON در گیت
        نگه‌داری می‌شوند، نه در دیتابیس — و این یک تصمیم عمدی است. گلدن‌ست{" "}
        <strong>آرتیفکت مهندسی</strong> است، نه داده‌ی کاربر: باید در پول‌ریکوئست بازبینی شود،
        دیف داشته باشد و تاریخچه‌اش قابل ردیابی باشد. «چه کسی این کیس را عوض کرد و چرا؟» سؤال
        مهمی است؛ اگر معیار سنجش بی‌سروصدا در یک جدول تغییر کند، نمره‌ها بالا می‌روند بدون
        اینکه بات بهتر شده باشد. گیت جلوی این را می‌گیرد.
      </Teach>

      {!suites.length ? (
        <EmptyState
          title="هیچ مجموعه‌ای پیدا نشد"
          description="پوشه‌ی suites/ خالی است یا فایل JSON آن با اسکیمای CaseSchema نمی‌خواند. یک فایل معتبر آنجا بگذارید تا اینجا ظاهر شود."
        />
      ) : (
        suites.map((suite) => <SuiteBlock key={suite.id} suite={suite} />)
      )}
    </div>
  );
}

function SuiteBlock({ suite }: { suite: Suite }) {
  // دسته‌ها را به ترتیب اولین ظهورشان در فایل نگه می‌داریم تا با خود JSON بخواند.
  const categories = Array.from(new Set(suite.cases.map((c) => c.category)));

  return (
    <section className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">{suite.title}</h2>
            {suite.description && (
              <p className="mt-1 max-w-2xl text-sm text-slate">{suite.description}</p>
            )}
          </div>
          <div className="shrink-0 text-left">
            <div className="tnum font-heading text-2xl font-bold">{faNum(suite.cases.length)}</div>
            <div className="text-xs text-slate">کیس</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip bg-sand/60 text-slate">
            شناسه: <code className="text-ink">{suite.id}</code>
          </span>
          <span className="chip bg-sand/60 text-slate">
            {faNum(categories.length)} دسته
          </span>
        </div>
      </div>

      {categories.map((category) => {
        const rows = suite.cases.filter((c) => c.category === category);
        return (
          <div key={category} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-sand px-4 py-3">
              <h3 className="font-heading text-sm font-semibold">{category}</h3>
              <span className="tnum text-xs text-slate">{faNum(rows.length)} کیس</span>
            </div>

            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[56rem] text-right text-sm">
                <thead className="bg-bone/60 text-xs text-slate">
                  <tr>
                    <th className="px-4 py-2 font-medium">شناسه</th>
                    <th className="px-4 py-2 font-medium">آخرین پیام کاربر</th>
                    <th className="px-4 py-2 font-medium">رفتار مورد انتظار</th>
                    <th className="px-4 py-2 font-medium">نشانه‌ی شکست</th>
                    <th className="px-4 py-2 font-medium">وزن</th>
                    <th className="px-4 py-2 font-medium">پشتوانه‌ی دانش</th>
                    <th className="px-4 py-2 font-medium">نوبت</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <CaseRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function CaseRow({ c }: { c: EvalCase }) {
  const lastUser = c.turns[c.turns.length - 1].user;
  const multi = c.turns.length > 1;

  return (
    <tr className="border-t border-sand/70 align-top">
      <td className="px-4 py-3">
        <code className="text-xs text-slate">{c.id}</code>
      </td>
      <td className="max-w-xs px-4 py-3 leading-7">{lastUser}</td>
      <td className="max-w-xs px-4 py-3 text-xs leading-6 text-slate">{c.expected}</td>
      <td className="max-w-xs px-4 py-3 text-xs leading-6 text-fail">{c.failureSignal}</td>
      <td className="tnum px-4 py-3 font-medium">{faNum(c.weight)}</td>
      <td className="px-4 py-3">
        {c.groundedExpected ? (
          <span className="chip bg-pass/10 text-pass">باید از دانش پشتیبانی شود</span>
        ) : (
          <span className="chip bg-brass/10 text-brass">کیس ضدتوهم</span>
        )}
      </td>
      <td className="px-4 py-3">
        {multi ? (
          <span className="chip bg-sand/70 text-ink">چندنوبتی · {faNum(c.turns.length)}</span>
        ) : (
          <span className="tnum text-xs text-slate">{faNum(c.turns.length)}</span>
        )}
      </td>
    </tr>
  );
}
