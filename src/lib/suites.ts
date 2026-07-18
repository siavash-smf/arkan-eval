import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { SuiteSchema, type Suite } from "./types";

/**
 * مجموعه‌های آزمون از فایل JSON در پوشه‌ی suites/ خوانده می‌شوند، نه از دیتابیس.
 *
 * چرا فایل؟ چون گلدن‌ست یک آرتیفکت مهندسی است، نه داده‌ی کاربر:
 * باید در گیت باشد، در پول‌ریکوئست بازبینی شود، و تاریخچه‌اش قابل ردیابی باشد.
 * «چه کسی و چرا این کیس را عوض کرد» سؤال مهمی است — و گیت جوابش را دارد.
 */

const SUITES_DIR = path.join(process.cwd(), "suites");

export async function listSuites(): Promise<Suite[]> {
  try {
    const files = await readdir(SUITES_DIR);
    const suites: Suite[] = [];
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      try {
        const raw = await readFile(path.join(SUITES_DIR, f), "utf8");
        suites.push(SuiteSchema.parse(JSON.parse(raw)));
      } catch {
        // یک فایل خراب نباید بقیه را از دسترس خارج کند.
      }
    }
    return suites;
  } catch {
    return [];
  }
}

export async function getSuite(id: string): Promise<Suite | null> {
  const raw = await readFile(path.join(SUITES_DIR, `${id}.json`), "utf8").catch(() => null);
  if (!raw) return null;
  const parsed = SuiteSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}
