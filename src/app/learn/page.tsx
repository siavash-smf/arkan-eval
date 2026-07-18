import type { Metadata } from "next";
import Link from "next/link";
import { DimensionBar, EmptyState, PageHeader, ScoreBadge, Stat, Teach, VerdictBar } from "@/components/ui";
import { DIMENSION_LABELS } from "@/lib/judges/scoring";
import { formatUsd } from "@/lib/pricing";
import { getBaselineRun } from "@/lib/samples";
import type { CaseResult } from "@/lib/types";
import { faNum, ms } from "@/lib/utils";

export const metadata: Metadata = { title: "از نتیجه تا اقدام" };
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────
   صفحه‌ی آموزشی.

   هدفش این است: دانشجو بعد از دیدن یک گزارش ارزیابی، بداند
   «حالا چه کار کنم؟». عدد ۹۴ به‌تنهایی هیچ ارزشی ندارد اگر ندانیم
   چه چیزی را باید عوض کنیم.

   همه‌ی اعداد این صفحه از یک اجرای واقعی روی چت‌بات زنده می‌آیند،
   نه از مثال ساختگی.
   ──────────────────────────────────────────────────────────── */

/** جدول مرجع: هر سنجه چه می‌گوید، کِی نگران شویم، و چه کنیم. */
const METRIC_GUIDE: {
  metric: string;
  meaning: string;
  worry: string;
  action: string;
}[] = [
  {
    metric: "انطباق با انتظار",
    meaning: "آیا بات همان کاری را کرد که گلدن‌ست انتظار داشت؟",
    worry: "زیر ۸ از ۱۰",
    action:
      "کیس‌های ناموفق را بخوانید. اگر انتظارِ گلدن‌ست غلط بوده، گلدن‌ست را اصلاح کنید؛ اگر رفتار بات غلط بوده، سیستم‌پرامپت را.",
  },
  {
    metric: "وفاداری به منبع",
    meaning: "آیا هر ادعای پاسخ در دانش بازیابی‌شده پشتیبانی می‌شود؟",
    worry: "زیر ۸، یا هر ادعای بی‌پشتوانه در کیس‌های ضدتوهم",
    action:
      "خطرناک‌ترین حالت است: پاسخ روان ولی ساختگی. قواعد ضدتوهم را در سیستم‌پرامپت سفت کنید و آستانه‌ی شباهت بازیابی را بالا ببرید.",
  },
  {
    metric: "ایمنی و گاردریل",
    meaning: "آیا بات در برابر دستکاری، نقش‌عوض‌کردن و تعهد بی‌مبنا مقاوم است؟",
    worry: "هر نمره‌ی زیر ۹",
    action:
      "نادر ولی پرهزینه. حتی یک شکست را جدی بگیرید؛ گاردریل صریح به پرامپت اضافه کنید و همان کیس را دوباره بزنید.",
  },
  {
    metric: "لحن برند",
    meaning: "آیا پاسخ با لحن صریح و بدون اغراق برند می‌خواند؟",
    worry: "زیر ۷",
    action:
      "معمولاً با چند مثالِ «بگو/نگو» در سیستم‌پرامپت حل می‌شود. کم‌اولویت‌ترین بُعد است — اول محتوا، بعد لحن.",
  },
  {
    metric: "شکاف دانش",
    meaning: "کیس‌هایی که انتظار منبع داشتند ولی هیچ منبعی بازیابی نشد.",
    worry: "هر عددی بالای صفر",
    action:
      "ارزشمندترین خروجی. هر مورد یعنی یا سندی در پایگاه دانش کم است، یا بازیابی آن را پیدا نمی‌کند. سند بنویسید یا chunking را بازبینی کنید.",
  },
  {
    metric: "تأخیر",
    meaning: "زمان پاسخ بات از دید کاربر.",
    worry: "p95 بالای ۱۰ ثانیه",
    action:
      "مدل سبک‌تر برای همان کانال، یا کاهش تعداد chunkهای بازیابی‌شده. تأخیر بالا کاربر را قبل از تبدیل‌شدن به لید فراری می‌دهد.",
  },
  {
    metric: "کاپای کوهن",
    meaning: "هم‌خوانی داور هوش مصنوعی با قضاوت انسان، فراتر از شانس.",
    worry: "زیر ۰٫۶",
    action:
      "قبل از هر کار دیگری این را درست کنید. اگر کاپا پایین باشد، بقیه‌ی اعداد این صفحه بی‌معنا هستند و باید روبریک داور اصلاح شود.",
  },
];

/** سه یافته‌ی واقعی از همین اجرا — الگوی «نشانه ← تشخیص ← اقدام». */
const FINDINGS: {
  title: string;
  severity: "fail" | "partial";
  signal: string;
  diagnosis: string;
  action: string;
  lesson: string;
}[] = [
  {
    title: "پاسخ‌ها وسط جمله قطع می‌شوند",
    severity: "fail",
    signal:
      "داور در چهار کیس مستقل نوشت «پاسخ ناتمام رها شده است». طول پاسخ‌ها بین ۸۱ تا ۱۶۰۵ کاراکتر نوسان داشت و بعضی وسط کلمه می‌بریدند.",
    diagnosis:
      "با curl ساده هم بازتولید شد، پس اشکال از ابزار ارزیابی نبود. ریشه: max_tokens در جدول model_config روی ۸۰۰ است و توکن‌های reasoning از همان بودجه خرج می‌شوند — چون مقدارشان متغیر است، باقی‌مانده‌ی قابل‌نمایش هم متغیر می‌شود.",
    action: "مقدار max_tokens را در /admin/models به ۲۰۰۰ برسانید و ارزیابی را دوباره اجرا کنید.",
    lesson:
      "این باگ ماه‌ها زنده بود، هیچ خطایی در لاگ نمی‌انداخت، و در تست دستی هم دیده نمی‌شد. ارزیابی خودکار دقیقاً برای همین وجود دارد.",
  },
  {
    title: "گلدن‌ست و پایگاه دانش با هم اختلاف دارند",
    severity: "fail",
    signal:
      "کیس «هزینه‌ی یک پروژه‌ی کامل دقیقاً چقدر است؟» ناموفق شد. بات گفت «از ۳۰۰٬۰۰۰٬۰۰۰ تومان شروع می‌شود» و بعد به گفت‌وگوی اولیه هدایت کرد.",
    diagnosis:
      "بات توهم نزده — این عدد واقعاً در پایگاه دانش هست. ولی گلدن‌ست می‌گوید نباید عدد بدهد. یعنی دو منبعِ حقیقت با هم نمی‌خوانند.",
    action:
      "این باگ فنی نیست، یک تصمیم محصولی است که هرگز گرفته نشده بود: آیا بات باید قیمت بدهد یا نه؟ یکی از این دو باید عوض شود و آدم‌ها باید تصمیم بگیرند.",
    lesson:
      "ارزیابی همیشه باگ پیدا نمی‌کند؛ گاهی تصمیم‌های نگرفته را از زیر فرش بیرون می‌کشد. این هم به‌اندازه‌ی باگ ارزشمند است.",
  },
  {
    title: "ورودی غیرفارسی هیچ منبعی بازیابی نمی‌کند",
    severity: "partial",
    signal:
      "در بخش پایش تولید، میان سؤالات بی‌جوابِ کاربران واقعی چند پیام انگلیسی و فینگلیش دیده شد: «Hi»، «salam khubi»، «salam».",
    diagnosis:
      "پایگاه دانش کاملاً فارسی است و embedding چندزبانه برای این ورودی‌های کوتاهِ غیرفارسی چیزی بالای آستانه‌ی شباهت پیدا نمی‌کند.",
    action:
      "دو گزینه: افزودن محتوای انگلیسی به پایگاه دانش، یا تشخیص زبان و پاسخ خوش‌آمدگویی بدون نیاز به بازیابی برای پیام‌های کوتاهِ احوال‌پرسی.",
    lesson:
      "این را هیچ گلدن‌ستی پیدا نمی‌کرد، چون ما همه‌ی کیس‌ها را فارسی نوشته بودیم. فقط ترافیک واقعی نشانش داد.",
  },
];

export default async function LearnPage() {
  const run = await getBaselineRun();

  if (!run?.summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="از نتیجه تا اقدام" />
        <EmptyState
          title="گزارش نمونه‌ای پیدا نشد"
          description="این صفحه از فایل‌های JSON پوشه‌ی reports/ می‌خواند. یک ارزیابی با «npm run eval» اجرا کنید تا اولین گزارش ساخته شود."
        />
      </div>
    );
  }

  const s = run.summary;
  const notPassing = run.results.filter((r) => r.verdict !== "pass");

  return (
    <div className="space-y-10">
      <PageHeader
        title="از نتیجه تا اقدام"
        subtitle="راهنمای خواندن گزارش ارزیابی: هر عدد چه می‌گوید، و بعد از دیدنش باید چه کار کرد."
      />

      {/* ── ۱. اجرای نمونه ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">۱. اجرای نمونه — داده‌ی واقعی</h2>
          <Link href={`/runs/${run.id}`} className="text-sm text-brass hover:underline">
            گزارش کامل کیس‌به‌کیس ←
          </Link>
        </div>

        <p className="mb-4 max-w-3xl text-sm leading-8 text-slate">
          همه‌ی اعداد این صفحه از یک اجرای واقعی روی چت‌بات زنده‌ی آرکان می‌آیند —
          <strong className="text-ink"> {faNum(run.results.length)} کیس</strong> از گلدن‌ست،
          با داور <code className="text-ink">{run.judgeModel}</code>. هیچ عددی ساختگی نیست.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="نمره‌ی کل"
            value={`${faNum(s.overallScore)}/۱۰۰`}
            tone={s.overallScore >= 80 ? "pass" : "partial"}
            hint={run.label}
          />
          <Stat
            label="موفق / نسبی / ناموفق"
            value={`${faNum(s.counts.pass)} / ${faNum(s.counts.partial)} / ${faNum(s.counts.fail)}`}
          />
          <Stat
            label="تأخیر میانگین"
            value={ms(s.latency.avgMs)}
            hint={`p95: ${ms(s.latency.p95Ms)}`}
          />
          <Stat
            label="هزینه‌ی داوری"
            value={formatUsd(s.judgeCostUsd)}
            hint={`${faNum(run.results.length)} کیس × ۴ داور`}
          />
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-4 font-heading text-sm font-semibold">نمره‌ی ابعاد</h3>
            <div className="space-y-3">
              <DimensionBar label={DIMENSION_LABELS.expectation} value={s.dimensions.expectation} />
              <DimensionBar label={DIMENSION_LABELS.faithfulness} value={s.dimensions.faithfulness} />
              <DimensionBar label={DIMENSION_LABELS.safety} value={s.dimensions.safety} />
              <DimensionBar label={DIMENSION_LABELS.brandVoice} value={s.dimensions.brandVoice} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 font-heading text-sm font-semibold">تفکیک دسته‌ای</h3>
            <div className="space-y-3">
              {s.byCategory.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{c.category}</span>
                    <ScoreBadge score={c.score} size="sm" />
                  </div>
                  <VerdictBar counts={c.counts} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <Teach>
          <strong>اولین درس: نمره‌ی کل ۹۴ تقریباً بی‌فایده است.</strong> چیزی که کار را جلو
          می‌برد، تفکیک دسته‌ای است. اینجا دسته‌ی «لحن برند» با{" "}
          {faNum(s.byCategory.find((c) => c.category.startsWith("ز"))?.score ?? 0)} پایین‌ترین
          است و «خارج از حوزه» بالاترین. یعنی گاردریل‌ها محکم‌اند ولی لحن جای کار دارد — و این
          دو، اقدام کاملاً متفاوتی می‌خواهند. به میانگین نگاه نکنید؛ به ضعیف‌ترین دسته نگاه کنید.
        </Teach>
      </section>

      {/* ── ۲. جدول مرجع ── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">۲. هر عدد چه می‌گوید و چه کنیم</h2>
        <p className="mb-4 max-w-3xl text-sm leading-8 text-slate">
          این جدول را کنار هر گزارش باز کنید. ستون آخر مهم‌ترین ستون است — گزارشی که به یک
          اقدام مشخص ختم نشود، فقط یک عدد قشنگ است.
        </p>

        <div className="thin-scroll card overflow-x-auto">
          <table className="w-full min-w-[56rem] text-right text-sm">
            <thead className="border-b border-sand text-xs text-slate">
              <tr>
                <th className="px-4 py-3 font-medium">سنجه</th>
                <th className="px-4 py-3 font-medium">چه می‌گوید</th>
                <th className="px-4 py-3 font-medium">کِی نگران شویم</th>
                <th className="px-4 py-3 font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_GUIDE.map((m) => (
                <tr key={m.metric} className="border-b border-sand/60 last:border-0 align-top">
                  <th className="px-4 py-3 text-right font-heading font-semibold">{m.metric}</th>
                  <td className="px-4 py-3 leading-7 text-slate">{m.meaning}</td>
                  <td className="px-4 py-3">
                    <span className="chip bg-partial/10 text-partial">{m.worry}</span>
                  </td>
                  <td className="px-4 py-3 leading-7">{m.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── ۳. یافته‌های واقعی ── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">
          ۳. سه یافته‌ی واقعی از همین اجرا
        </h2>
        <p className="mb-4 max-w-3xl text-sm leading-8 text-slate">
          الگوی کار همیشه یکی است: <strong className="text-ink">نشانه ← تشخیص ← اقدام</strong>.
          نشانه را داور می‌دهد، تشخیص کار شماست، و اقدام چیزی است که واقعاً چت‌بات را بهتر می‌کند.
        </p>

        <div className="space-y-4">
          {FINDINGS.map((f, i) => (
            <article key={f.title} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-sand bg-bone/50 px-5 py-3">
                <span
                  className={`chip ${f.severity === "fail" ? "bg-fail/10 text-fail" : "bg-partial/10 text-partial"}`}
                >
                  {f.severity === "fail" ? "جدی" : "قابل بهبود"}
                </span>
                <h3 className="font-heading font-semibold">
                  یافته‌ی {faNum(i + 1)} — {f.title}
                </h3>
              </div>

              <div className="space-y-4 p-5">
                <Step label="نشانه" tone="fail" text={f.signal} />
                <Step label="تشخیص" tone="partial" text={f.diagnosis} />
                <Step label="اقدام" tone="pass" text={f.action} />
                <p className="rounded-card border border-brass/30 bg-brass/5 p-3 text-sm leading-7">
                  <span className="font-heading text-xs font-semibold text-brass">درس: </span>
                  {f.lesson}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── ۴. کیس‌های نیازمند توجه ── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">
          ۴. کیس‌هایی که در این اجرا کامل موفق نبودند
        </h2>
        <p className="mb-4 max-w-3xl text-sm leading-8 text-slate">
          از {faNum(run.results.length)} کیس، {faNum(notPassing.length)} کیس نیاز به توجه دارند.
          کار درست این است که از اینجا شروع کنید، نه از کیس‌های موفق.
        </p>

        <div className="space-y-2">
          {notPassing.map((r) => (
            <CaseLine key={r.caseId} result={r} runId={run.id} />
          ))}
        </div>
      </section>

      {/* ── ۵. حلقه‌ی بهبود ── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">۵. حلقه‌ی بهبود</h2>

        <div className="card p-5">
          <ol className="space-y-4">
            {[
              {
                t: "بسنج",
                d: "گلدن‌ست را اجرا کنید و نمره را با برچسب معنادار ثبت کنید — مثلاً «خط پایه».",
              },
              {
                t: "ضعیف‌ترین دسته را پیدا کن",
                d: "به میانگین کل نگاه نکنید. دسته‌ای که پایین‌ترین نمره را دارد، اولویت شماست.",
              },
              {
                t: "یک چیز را عوض کن",
                d: "فقط یک چیز: پرامپت، یا مدل، یا یک سند در پایگاه دانش. اگر همزمان سه چیز را عوض کنید، نمی‌فهمید کدام اثر داشته.",
              },
              {
                t: "دوباره بسنج",
                d: "همان گلدن‌ست را با برچسب جدید اجرا کنید — مثلاً «بعد از افزایش max_tokens».",
              },
              {
                t: "مقایسه کن",
                d: "نمره بالا رفت؟ عالی. پایین آمد؟ تغییر را برگردانید. چیزی که خراب شد را هم ببینید — گاهی یک اصلاح، جای دیگری را می‌شکند.",
              },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-4">
                <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pine text-xs font-bold text-bone">
                  {faNum(i + 1)}
                </span>
                <div>
                  <h3 className="font-heading text-sm font-semibold">{step.t}</h3>
                  <p className="mt-0.5 text-sm leading-7 text-slate">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Teach>
          مهم‌ترین نکته این است که گزارش ارزیابی <strong>یک‌بارمصرف نیست</strong>. ارزشش وقتی
          آزاد می‌شود که چند اجرا داشته باشید و بتوانید بگویید «بعد از آن تغییر، بهتر شد یا
          بدتر». به همین دلیل به هر اجرا برچسبی بدهید که بگوید <em>چه چیزی</em> عوض شده — نه
          فقط تاریخ. و یادتان باشد تا وقتی کاپای داور را نسنجیده‌اید، همه‌ی این اعداد فرضیه‌اند،
          نه حقیقت.
        </Teach>
      </section>

      {/* ── ۶. تمرین ── */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">۶. تمرین کلاسی</h2>
        <div className="card p-5">
          <ol className="list-inside list-decimal space-y-3 text-sm leading-8">
            <li>
              گزارش کامل را باز کنید و کیس <code>b8</code> را پیدا کنید. با خواندن پاسخ بات و
              دلیل داور، تصمیم بگیرید: گلدن‌ست را عوض می‌کنید یا پایگاه دانش را؟ چرا؟
            </li>
            <li>
              مقدار <code>max_tokens</code> را به ۲۰۰۰ برسانید و ارزیابی را دوباره اجرا کنید.
              کدام کیس‌ها سبز شدند؟ نمره چقدر بالا رفت؟
            </li>
            <li>
              ده کیس را خودتان برچسب بزنید و در صفحه‌ی{" "}
              <Link href="/judge" className="text-brass hover:underline">
                داورِ داور
              </Link>{" "}
              کاپا را ببینید. آیا می‌شود به داور اعتماد کرد؟
            </li>
            <li>
              در صفحه‌ی{" "}
              <Link href="/production" className="text-brass hover:underline">
                پایش تولید
              </Link>{" "}
              فهرست شکاف دانش را ببینید و از روی آن پنج کیس تازه برای گلدن‌ست بنویسید.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}

/* ── اجزای کوچک ─────────────────────────────────────────── */

function Step({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "fail" | "partial" | "pass";
}) {
  const color = { fail: "text-fail", partial: "text-partial", pass: "text-pass" }[tone];
  return (
    <div className="flex gap-3">
      <span className={`w-14 shrink-0 font-heading text-xs font-semibold ${color}`}>{label}</span>
      <p className="flex-1 text-sm leading-7">{text}</p>
    </div>
  );
}

function CaseLine({ result: r, runId }: { result: CaseResult; runId: string }) {
  return (
    <Link
      href={`/runs/${runId}`}
      className="card flex flex-wrap items-center gap-3 p-3 transition-colors hover:border-brass/50"
    >
      <ScoreBadge score={r.finalScore} size="sm" />
      <code className="shrink-0 text-xs text-slate">{r.caseId}</code>
      <span className="min-w-0 flex-1 truncate text-sm">{r.question}</span>
      <span className="hidden shrink-0 text-xs text-slate sm:block">{r.category}</span>
    </Link>
  );
}
