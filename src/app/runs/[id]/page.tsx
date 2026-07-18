import type { Metadata } from "next";
import { RunReport } from "@/components/RunReport";
import { PageHeader } from "@/components/ui";
import { getStore } from "@/lib/store";
import { faNum, relTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "گزارش ارزیابی" };

export default async function RunPage({ params }: { params: { id: string } }) {
  // اجرا را سمت سرور می‌گیریم تا صفحه بدون فلاش خالی رندر شود؛
  // بعد کامپوننت کلاینت اگر اجرا در جریان باشد خودش poll می‌کند.
  const run = await getStore().getRun(params.id);

  return (
    <div>
      <PageHeader
        title={run?.label || run?.suiteTitle || "گزارش ارزیابی"}
        subtitle={
          run
            ? `${run.targetLabel} · داور: ${run.judgeModel} · ${faNum(run.results.length)} کیس · ${relTime(run.createdAt)}`
            : undefined
        }
      />
      <RunReport runId={params.id} initial={run} />
    </div>
  );
}
