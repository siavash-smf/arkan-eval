import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EvalRun, HumanLabel } from "../types";
import type { BlogStoreLike } from "./index";

/**
 * ذخیره‌سازی روی Supabase.
 *
 * تصمیم طراحی: نتایج به‌صورت jsonb در یک ستون ذخیره می‌شوند، نه در
 * جدول جداگانه با ردیف به‌ازای هر کیس. چرا؟ چون هرگز روی تک‌کیس
 * کوئری نمی‌زنیم — همیشه کل گزارش را با هم می‌خوانیم. نرمال‌سازی
 * اینجا فقط پیچیدگی اضافه می‌کرد. (اگر روزی خواستیم روی کیس‌ها
 * فیلتر و تجمیع بزنیم، آن‌وقت وقتِ نرمال‌سازی است.)
 */
export class SupabaseStore implements BlogStoreLike {
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: {
        // ⚠️ بدون این، Next.js پاسخ‌های Supabase را در Data Cache نگه می‌دارد.
        // چون supabase-js زیر کاپوت از fetch استفاده می‌کند و نکست همه‌ی
        // fetchها را به‌صورت پیش‌فرض کش می‌کند.
        //
        // علامتش گیج‌کننده است: صفحه‌ی «داورِ داور» که اولین بار با صفر
        // برچسب رندر شده بود، همان پاسخ خالی را برای همیشه نشان می‌داد،
        // در حالی که API همان لحظه دو برچسب برمی‌گرداند.
        //
        // همان تله‌ای که فاز ۲ هنگام خواندن بلاگ خورد.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
  }

  async saveRun(run: EvalRun): Promise<void> {
    const { error } = await this.db.from("eval_runs").upsert({
      id: run.id,
      status: run.status,
      created_at: run.createdAt,
      finished_at: run.finishedAt ?? null,
      suite_id: run.suiteId,
      suite_title: run.suiteTitle,
      target_id: run.targetId,
      target_label: run.targetLabel,
      judge_model: run.judgeModel,
      label: run.label,
      progress: run.progress,
      results: run.results,
      summary: run.summary,
      error: run.error ?? null,
    });
    if (error) throw new Error(`ذخیره‌ی اجرا شکست خورد: ${error.message}`);
  }

  async getRun(id: string): Promise<EvalRun | null> {
    const { data, error } = await this.db.from("eval_runs").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return rowToRun(data);
  }

  async listRuns(limit = 20): Promise<EvalRun[]> {
    const { data, error } = await this.db
      .from("eval_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(rowToRun);
  }

  async saveLabel(label: HumanLabel): Promise<void> {
    const { error } = await this.db.from("eval_human_labels").upsert(
      {
        id: label.id,
        run_id: label.runId,
        case_id: label.caseId,
        human_verdict: label.humanVerdict,
        judge_verdict: label.judgeVerdict,
        note: label.note,
        created_at: label.createdAt,
      },
      { onConflict: "run_id,case_id" }
    );
    if (error) throw new Error(`ذخیره‌ی برچسب شکست خورد: ${error.message}`);
  }

  async listLabels(runId?: string): Promise<HumanLabel[]> {
    let q = this.db.from("eval_human_labels").select("*");
    if (runId) q = q.eq("run_id", runId);
    const { data, error } = await q.order("created_at", { ascending: false });
    // خطا را صریح بالا می‌بریم؛ آرایه‌ی خالیِ دروغین باعث می‌شود
    // صفحه‌ی «داورِ داور» بگوید «برچسبی ثبت نشده» در حالی که مشکل
    // چیز دیگری است.
    if (error) throw new Error(`خواندن برچسب‌ها شکست خورد: ${error.message}`);
    if (!data) return [];
    return data.map((r) => ({
      id: r.id,
      runId: r.run_id,
      caseId: r.case_id,
      humanVerdict: r.human_verdict,
      judgeVerdict: r.judge_verdict,
      note: r.note ?? "",
      createdAt: r.created_at,
    }));
  }
}

function rowToRun(r: any): EvalRun {
  return {
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    suiteId: r.suite_id,
    suiteTitle: r.suite_title,
    targetId: r.target_id,
    targetLabel: r.target_label,
    judgeModel: r.judge_model,
    label: r.label ?? "",
    progress: r.progress ?? { done: 0, total: 0 },
    results: r.results ?? [],
    summary: r.summary,
    error: r.error,
  };
}
