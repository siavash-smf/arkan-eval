import type { Metadata } from "next";
import Link from "next/link";
import { computeAlignment, kappaLabel } from "@/lib/alignment";
import { getStore } from "@/lib/store";
import { VERDICTS, VERDICT_LABELS, type HumanLabel } from "@/lib/types";
import { cx, faNum, pct, relTime } from "@/lib/utils";
import { EmptyState, PageHeader, Stat, Teach, VerdictChip } from "@/components/ui";

export const metadata: Metadata = { title: "داورِ داور" };
export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const labels = await getStore().listLabels();
  const alignment = computeAlignment(labels);
  const k = alignment.cohensKappa;

  const teach = (
    <Teach>
      ما داریم با یک مدل، مدل دیگری را نمره می‌دهیم — پس چه کسی داور را داوری می‌کند؟ جواب،
      همین صفحه است: چند ده کیس را انسان هم برچسب می‌زند و ما هم‌خوانی داور با انسان را
      می‌سنجیم. اما دقت کنید که <strong>نرخ توافق به‌تنهایی گمراه‌کننده است</strong>: اگر ۹۰٪
      کیس‌ها موفق باشند، داوری که چشم‌بسته همیشه «موفق» بگوید ۹۰٪ توافق می‌گیرد بدون اینکه
      ذره‌ای فهمیده باشد. دقیقاً به همین دلیل کاپای کوهن را حساب می‌کنیم: کاپا توافقِ فراتر از
      شانس را اندازه می‌گیرد. تفسیر رایج: زیر ۰٫۴ ضعیف، ۰٫۴ تا ۰٫۶ متوسط، ۰٫۶ تا ۰٫۸ خوب، بالای
      ۰٫۸ عالی. اگر کاپا پایین باشد، <strong>هیچ عددی در کل این داشبورد قابل اعتماد نیست</strong>{" "}
      — نه نمره‌ی کل، نه تفکیک دسته‌ای، نه مقایسه‌ی دو اجرا — و کار درست این است که به‌جای
      خوشحالی از نمره‌ها، روبریک داور در{" "}
      <code className="mx-1 text-ink">src/lib/judges/rubrics.ts</code> اصلاح شود.
    </Teach>
  );

  if (!alignment.total) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="داورِ داور"
          subtitle="متا-ارزیابی — سنجش اینکه خودِ داور هوش مصنوعی چقدر با قضاوت انسان می‌خواند."
        />
        <EmptyState
          title="هنوز هیچ برچسب انسانی ثبت نشده است"
          description="گزارش یکی از اجراها را باز کنید، روی یک کیس بزنید تا جزئیاتش باز شود، و در جعبه‌ی «نظر شما چیست؟» حکم خودتان را ثبت کنید. با چند ده برچسب، نرخ توافق و کاپای کوهن اینجا محاسبه می‌شوند."
        />
        {teach}
      </div>
    );
  }

  const disagreements = labels.filter((l) => l.humanVerdict !== l.judgeVerdict);

  // موارد توافقی که یادداشت دارند. اختلاف نداشتن یعنی داور درست حکم داده،
  // ولی یادداشت انسان ممکن است هنوز حرفی برای گفتن داشته باشد — مثلاً
  // «حکم درست بود ولی دلیلش سطحی بود». اگر اینجا نشانشان ندهیم، آن حرف
  // برای همیشه گم می‌شود.
  const agreedNotes = labels.filter(
    (l) => l.humanVerdict === l.judgeVerdict && l.note.trim()
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="داورِ داور"
        subtitle="متا-ارزیابی — سنجش اینکه خودِ داور هوش مصنوعی چقدر با قضاوت انسان می‌خواند."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="برچسب انسانی"
          value={faNum(alignment.total)}
          hint={`${faNum(alignment.agreed)} توافق · ${faNum(disagreements.length)} اختلاف`}
        />
        <Stat
          label="نرخ توافق"
          value={pct(alignment.agreementRate, 1)}
          hint="به‌تنهایی کافی نیست"
          tone={alignment.agreementRate >= 80 ? "pass" : alignment.agreementRate >= 60 ? "partial" : "fail"}
        />
        <Stat
          label="کاپای کوهن"
          value={k === null ? "—" : faNum(k.toFixed(2))}
          hint={kappaLabel(k)}
          tone={k === null ? "default" : k >= 0.6 ? "pass" : k >= 0.4 ? "partial" : "fail"}
        />
      </div>

      {/* ── ماتریس درهم‌ریختگی ── */}
      <div className="card p-5">
        <h2 className="font-heading font-semibold">ماتریس درهم‌ریختگی</h2>
        <p className="mt-1 text-xs leading-6 text-slate">
          سطرها حکم انسان، ستون‌ها حکم داور. قطر اصلی توافق است؛ هر خانه‌ی خارج از قطر یک مورد
          اختلاف را نشان می‌دهد.
        </p>

        <div className="thin-scroll mt-4 overflow-x-auto">
          <table className="min-w-[28rem] text-right text-sm">
            <thead>
              <tr className="text-xs text-slate">
                <th className="px-3 py-2 font-medium">انسان \ داور</th>
                {VERDICTS.map((j) => (
                  <th key={j} className="px-3 py-2 font-medium">
                    {VERDICT_LABELS[j]}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">جمع سطر</th>
              </tr>
            </thead>
            <tbody>
              {VERDICTS.map((h) => {
                const rowTotal = VERDICTS.reduce((a, j) => a + alignment.matrix[h][j], 0);
                return (
                  <tr key={h} className="border-t border-sand/70">
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate">
                      {VERDICT_LABELS[h]}
                    </th>
                    {VERDICTS.map((j) => {
                      const n = alignment.matrix[h][j];
                      const diagonal = h === j;
                      return (
                        <td key={j} className="px-3 py-2">
                          <span
                            className={cx(
                              "tnum inline-block min-w-8 rounded-btn px-2 py-1 text-center font-medium",
                              diagonal
                                ? "bg-pass/10 text-pass"
                                : n > 0
                                  ? "bg-fail/10 text-fail"
                                  : "text-slate"
                            )}
                          >
                            {faNum(n)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="tnum px-3 py-2 text-slate">{faNum(rowTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── فهرست اختلاف‌ها ── */}
      <div className="card p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-heading font-semibold">موارد اختلاف</h2>
          <span className="tnum text-xs text-slate">{faNum(disagreements.length)} مورد</span>
        </div>
        <p className="mb-4 text-xs leading-6 text-slate">
          جایی که انسان و داور به یک نتیجه نرسیده‌اند. یادداشت‌ها بهترین راهنما برای اصلاح
          روبریک‌اند.
        </p>

        {disagreements.length ? (
          <ul className="space-y-2">
            {disagreements.map((l) => (
              <LabelRow key={l.id} label={l} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">
            داور در همه‌ی برچسب‌ها با انسان هم‌نظر بوده است. با نمونه‌ی کوچک، این خبرِ خوبی است
            که هنوز نباید خیلی جدی گرفته شود.
          </p>
        )}
      </div>

      {/* ── یادداشت روی موارد توافق ── */}
      {agreedNotes.length > 0 && (
        <div className="card p-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="font-heading font-semibold">یادداشت روی موارد توافق</h2>
            <span className="tnum text-xs text-slate">{faNum(agreedNotes.length)} مورد</span>
          </div>
          <p className="mb-4 text-xs leading-6 text-slate">
            جایی که حکم داور و انسان یکی بوده ولی انسان نکته‌ای نوشته است. توافق روی حکم،
            به‌معنای رضایت از استدلال نیست.
          </p>
          <ul className="space-y-2">
            {agreedNotes.map((l) => (
              <LabelRow key={l.id} label={l} agreed />
            ))}
          </ul>
        </div>
      )}

      {teach}
    </div>
  );
}

/** یک ردیف برچسب — هم برای اختلاف‌ها و هم برای توافق‌های یادداشت‌دار. */
function LabelRow({ label: l, agreed }: { label: HumanLabel; agreed?: boolean }) {
  return (
    <li className="rounded-card border border-sand bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={`/runs/${l.runId}`}
          className="font-mono text-slate hover:text-brass hover:underline"
        >
          {l.caseId}
        </Link>
        {agreed ? (
          <>
            <span className="text-slate">حکم مشترک:</span>
            <VerdictChip verdict={l.humanVerdict} />
          </>
        ) : (
          <>
            <span className="text-slate">انسان:</span>
            <VerdictChip verdict={l.humanVerdict} />
            <span className="text-slate">داور:</span>
            <VerdictChip verdict={l.judgeVerdict} />
          </>
        )}
        <span className="mr-auto text-slate">{relTime(l.createdAt)}</span>
      </div>
      {l.note && <p className="mt-2 text-sm leading-7">{l.note}</p>}
    </li>
  );
}
