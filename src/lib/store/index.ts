import type { EvalRun, HumanLabel } from "../types";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";

/* ────────────────────────────────────────────────────────────
   الگوی Adapter — همان تصمیم فاز ۳.

   کل سیستم فقط با این اینترفیس حرف می‌زند. اگر Supabase تنظیم
   نشده باشد، خودکار روی حافظه می‌افتد. یعنی دانشجو می‌تواند بدون
   ساختن هیچ دیتابیسی پروژه را بالا بیاورد و کار کند — و بعد با
   گذاشتن دو متغیر محیطی، ماندگارش کند. بدون تغییر یک خط کد.
   ──────────────────────────────────────────────────────────── */

export interface BlogStoreLike {
  saveRun(run: EvalRun): Promise<void>;
  getRun(id: string): Promise<EvalRun | null>;
  listRuns(limit?: number): Promise<EvalRun[]>;
  saveLabel(label: HumanLabel): Promise<void>;
  listLabels(runId?: string): Promise<HumanLabel[]>;
}

let cached: BlogStoreLike | null = null;

export function getStore(): BlogStoreLike {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cached = url && key ? new SupabaseStore(url, key) : new MemoryStore();
  return cached;
}

export function storeKind(): "supabase" | "memory" {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "supabase"
    : "memory";
}
