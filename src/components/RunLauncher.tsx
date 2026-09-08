"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client-auth";

type SuiteMeta = {
  id: string;
  title: string;
  caseCount: number;
  categories: string[];
};

/**
 * راه‌انداز اجرا.
 *
 * الگوی مهم (وام‌گرفته از فاز ۳): شناسه‌ی اجرا را *کلاینت* می‌سازد،
 * نه سرور. پس به‌محض اینکه رکورد اجرا ساخته شد، می‌توانیم برویم
 * صفحه‌ی گزارش.
 *
 * این درخواست دیگر خودِ ارزیابی را انجام نمی‌دهد — فقط رکورد را
 * می‌سازد و برمی‌گردد. اجرای واقعی تکه‌تکه در صفحه‌ی گزارش جلو
 * می‌رود. قبلاً همه‌چیز در همین یک درخواست بود و روی سرورلس با
 * ۵۰۴ می‌مرد، چون هیچ تابعی ۳۱۴ ثانیه زنده نمی‌ماند.
 */
export function RunLauncher({ suites }: { suites: SuiteMeta[] }) {
  const router = useRouter();
  const [suiteId, setSuiteId] = useState(suites[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  const suite = suites.find((s) => s.id === suiteId);

  async function start() {
    setBusy(true);
    setError("");
    setPendingId("");

    const runId = crypto.randomUUID();

    try {
      const res = await apiFetch("/api/runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          suiteId,
          targetId: "http-chat",
          label,
          categories: category ? [category] : undefined,
          limit: limit ? Number(limit) : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `سرور کد ${res.status} برگرداند.`);
      }
      router.push(`/runs/${runId}`);
    } catch (e) {
      // حتی اگر این درخواست شکست خورد، ممکن است رکورد اجرا ساخته شده
      // باشد. پس به‌جای یک جمله‌ی بن‌بست، لینک گزارش را می‌دهیم.
      setError((e as Error).message);
      setPendingId(runId);
      setBusy(false);
    }
  }

  if (!suites.length) {
    return (
      <div className="card p-5 text-sm text-slate">
        هیچ مجموعه‌ی آزمونی در پوشه‌ی <code className="text-ink">suites/</code> پیدا نشد.
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="font-heading font-semibold">اجرای ارزیابی جدید</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm">مجموعه‌ی آزمون</span>
          <select className="field" value={suiteId} onChange={(e) => { setSuiteId(e.target.value); setCategory(""); }}>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.caseCount} کیس)
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">
            برچسب <span className="text-slate">(اختیاری)</span>
          </span>
          <input
            className="field"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثلاً: بعد از اصلاح پرامپت ضدتوهم"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">
            فقط یک دسته <span className="text-slate">(اختیاری)</span>
          </span>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">همه‌ی دسته‌ها</option>
            {suite?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">
            سقف تعداد کیس <span className="text-slate">(برای تست سریع)</span>
          </span>
          <input
            className="field"
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="خالی = همه"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={start} disabled={busy}>
          {busy ? "در حال اجرا…" : "شروع ارزیابی"}
        </button>
        <span className="text-xs text-slate">
          هدف بین درخواست‌ها ۳٫۲ ثانیه فاصله می‌گذارد تا به سقف نرخ چت‌بات نخورد؛
          اجرای کامل چند دقیقه طول می‌کشد و در صفحه‌ی گزارش تکه‌تکه جلو می‌رود.
          صفحه را تا پایان باز نگه دارید.
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-btn bg-fail/10 px-3 py-2 text-sm text-fail">
          {error}
          {pendingId && (
            <>
              {" — "}
              <a className="underline" href={`/runs/${pendingId}`}>
                باز کردن صفحه‌ی گزارش
              </a>
              {" (اگر رکورد اجرا ساخته شده باشد، از همان‌جا ادامه پیدا می‌کند)"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
