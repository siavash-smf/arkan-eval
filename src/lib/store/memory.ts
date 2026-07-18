import type { EvalRun, HumanLabel } from "../types";
import type { BlogStoreLike } from "./index";

/**
 * ذخیره‌سازی درون‌حافظه‌ای.
 * با ری‌استارت سرور پاک می‌شود — عمداً. برای توسعه و آموزش کافی است
 * و دانشجو را مجبور نمی‌کند قبل از دیدن اولین نتیجه، دیتابیس بسازد.
 */
export class MemoryStore implements BlogStoreLike {
  private runs = new Map<string, EvalRun>();
  private labels: HumanLabel[] = [];

  async saveRun(run: EvalRun): Promise<void> {
    // کپی عمیق تا تغییرات بعدیِ آبجکت زنده، تاریخچه را دستکاری نکند.
    this.runs.set(run.id, structuredClone(run));
  }

  async getRun(id: string): Promise<EvalRun | null> {
    const r = this.runs.get(id);
    return r ? structuredClone(r) : null;
  }

  async listRuns(limit = 20): Promise<EvalRun[]> {
    return Array.from(this.runs.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }

  async saveLabel(label: HumanLabel): Promise<void> {
    // هر کیس فقط یک برچسب انسانی دارد؛ برچسب جدید جای قبلی را می‌گیرد.
    this.labels = this.labels.filter(
      (l) => !(l.runId === label.runId && l.caseId === label.caseId)
    );
    this.labels.push(label);
  }

  async listLabels(runId?: string): Promise<HumanLabel[]> {
    return this.labels.filter((l) => !runId || l.runId === runId);
  }
}
