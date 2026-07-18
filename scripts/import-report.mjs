#!/usr/bin/env node
/**
 * وارد کردن یک گزارش JSON از پوشه‌ی reports/ به دیتابیس داشبورد.
 *
 * چرا لازم است؟ اگر ارزیابی را روی لپ‌تاپی اجرا کرده باشید که Supabase
 * تنظیم نداشته، نتیجه فقط روی دیسک نوشته شده و در داشبورد دیده نمی‌شود.
 * این اسکریپت همان فایل را به دیتابیس منتقل می‌کند.
 *
 *   node scripts/import-report.mjs reports/run-2026-07-18-15-06.json
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const file = process.argv[2];
if (!file) {
  console.error("\n❌ مسیر فایل گزارش را بدهید.");
  console.error("   node scripts/import-report.mjs reports/run-....json\n");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\n❌ متغیرهای Supabase تنظیم نشده‌اند.\n");
  process.exit(1);
}

const run = JSON.parse(readFileSync(path.resolve(ROOT, file), "utf8"));
const db = createClient(url, key, { auth: { persistSession: false } });

const { error } = await db.from("eval_runs").upsert({
  id: run.id,
  status: run.status,
  created_at: run.createdAt,
  finished_at: run.finishedAt ?? null,
  suite_id: run.suiteId,
  suite_title: run.suiteTitle,
  target_id: run.targetId,
  target_label: run.targetLabel,
  judge_model: run.judgeModel,
  label: run.label ?? "",
  progress: run.progress,
  results: run.results,
  summary: run.summary,
  error: run.error ?? null,
});

if (error) {
  console.error(`\n❌ وارد کردن شکست خورد: ${error.message}\n`);
  process.exit(1);
}

console.log(`\n✓ وارد شد: ${run.label || run.suiteTitle}`);
console.log(`  نمره: ${run.summary?.overallScore}/100 · ${run.results.length} کیس`);
console.log(`  شناسه: ${run.id}\n`);
