import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { EvalRun } from "./types";

/**
 * خواندن گزارش‌های نمونه از پوشه‌ی reports/.
 *
 * چرا از فایل و نه از دیتابیس؟ چون صفحه‌ی آموزشی باید **همیشه** چیزی
 * برای نشان‌دادن داشته باشد. اگر به دیتابیس وابسته باشد، دانشجویی که
 * پروژه را تازه کلون کرده صفحه‌ی خالی می‌بیند و درس از دست می‌رود.
 *
 * این گزارش‌ها در گیت‌اند، پس نتیجه‌ای که در کلاس نشان می‌دهید همان
 * چیزی است که دانشجو روی لپ‌تاپ خودش می‌بیند.
 */

const REPORTS_DIR = path.join(process.cwd(), "reports");

export async function listSampleRuns(): Promise<EvalRun[]> {
  try {
    const files = await readdir(REPORTS_DIR);
    const runs: EvalRun[] = [];

    for (const f of files.filter((f) => f.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(REPORTS_DIR, f), "utf8");
        const run = JSON.parse(raw) as EvalRun;
        if (run?.summary && Array.isArray(run.results)) runs.push(run);
      } catch {
        // یک فایل خراب نباید بقیه را از دسترس خارج کند.
      }
    }

    // اول کامل‌ترین اجرا، و بین اجراهای هم‌اندازه، تازه‌ترین.
    // بدون معیار دوم، وقتی دو اجرای ۳۲ کیسی کنار هم باشند ترتیب به
    // خروجی readdir بند می‌شود و صفحه ممکن است گزارش قدیمی را نشان بدهد.
    return runs.sort(
      (a, b) =>
        b.results.length - a.results.length ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  } catch {
    return [];
  }
}

/** کامل‌ترین و تازه‌ترین اجرای نمونه — مبنای روایت صفحه‌ی آموزشی. */
export async function getBaselineRun(): Promise<EvalRun | null> {
  const runs = await listSampleRuns();
  return runs[0] ?? null;
}
