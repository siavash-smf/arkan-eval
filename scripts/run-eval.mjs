#!/usr/bin/env node
/**
 * اجرای ارزیابی از خط فرمان.
 *
 * چرا CLI وقتی داشبورد داریم؟ چون ارزیابی باید در CI هم قابل اجرا باشد،
 * نه فقط با کلیک آدم. این اسکریپت همان کد داشبورد را صدا می‌زند
 * (هیچ منطقی اینجا تکرار نشده) و خروجی JSON و Markdown می‌سازد.
 *
 * نمونه‌ها:
 *   npm run eval
 *   npm run eval -- --limit 4
 *   npm run eval -- --category "و — ایمنی و دستکاری"
 *   npm run eval -- --label "بعد از اصلاح پرامپت"
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/* ── بارگذاری .env.local ─────────────────────────────────────
   Next.js این کار را خودش می‌کند ولی اسکریپت مستقل نه.
   یک لودر ساده کافی است؛ dotenv یک وابستگی اضافه بود. */
function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnv();

/* ── آرگومان‌ها ───────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const limit = arg("limit") ? Number(arg("limit")) : undefined;
const category = arg("category");
const label = arg("label", "");
const suiteName = arg("suite", "arkan-chatbot-golden");
const targetId = arg("target", "http-chat");

/* ── وارد کردن ماژول‌های TypeScript ──────────────────────────
   از type-stripping داخلی Node استفاده می‌کنیم (Node 22.6+).
   اگر نسخه‌ی Node قدیمی بود، پیام روشن می‌دهیم. */
let runEvaluation, resolveTarget, getStore, SuiteSchema, isConfigured, judgeModelId, VERDICT_LABELS;
try {
  register("./ts-loader.mjs", pathToFileURL(path.join(ROOT, "scripts/")));
  ({ runEvaluation } = await import(pathToFileURL(path.join(ROOT, "src/lib/runner.ts")).href));
  ({ resolveTarget } = await import(pathToFileURL(path.join(ROOT, "src/lib/targets/index.ts")).href));
  ({ getStore } = await import(pathToFileURL(path.join(ROOT, "src/lib/store/index.ts")).href));
  ({ SuiteSchema, VERDICT_LABELS } = await import(pathToFileURL(path.join(ROOT, "src/lib/types.ts")).href));
  ({ isConfigured, judgeModelId } = await import(pathToFileURL(path.join(ROOT, "src/lib/ai.ts")).href));
} catch (e) {
  console.error("\n❌ بارگذاری ماژول‌ها شکست خورد.");
  console.error("   این اسکریپت به Node نسخه‌ی ۲۲٫۶ یا بالاتر نیاز دارد (type-stripping).");
  console.error(`   نسخه‌ی فعلی: ${process.version}`);
  console.error(`   جزئیات: ${e.message}\n`);
  process.exit(1);
}

if (!isConfigured()) {
  console.error("\n❌ OPENROUTER_API_KEY تنظیم نشده است.");
  console.error("   فایل .env.local.example را به .env.local کپی کنید و کلید را بگذارید.\n");
  process.exit(1);
}

/* ── بارگذاری مجموعه‌ی آزمون ─────────────────────────────── */
const suitePath = path.join(ROOT, "suites", `${suiteName}.json`);
const suite = SuiteSchema.parse(JSON.parse(readFileSync(suitePath, "utf8")));

const target = resolveTarget(targetId);
const store = getStore();
const runId = randomUUID();

console.log(`\n🎯 هدف:      ${target.label}`);
console.log(`📋 مجموعه:   ${suite.title}`);
console.log(`⚖️  داور:     ${judgeModelId()}`);
if (category) console.log(`🔖 دسته:     ${category}`);
if (limit) console.log(`✂️  محدود به: ${limit} کیس`);
console.log("");

const started = Date.now();
const ICON = { pass: "✅", partial: "⚠️ ", fail: "❌" };

const run = await runEvaluation({
  runId,
  suite,
  target,
  label,
  limit,
  categories: category ? [category] : undefined,
  store,
  onProgress: (done, total, last) => {
    const bar = `[${String(done).padStart(2)}/${total}]`;
    const q = last.question.length > 42 ? last.question.slice(0, 42) + "…" : last.question;
    console.log(
      `${bar} ${ICON[last.verdict]} ${String(last.finalScore).padStart(3)}  ${last.caseId.padEnd(4)} ${q}`
    );
    if (last.error) console.log(`         ↳ خطا: ${last.error}`);
  },
});

/* ── خلاصه در ترمینال ────────────────────────────────────── */
const s = run.summary;
console.log("\n" + "─".repeat(60));
console.log(`نمره‌ی کل:        ${s.overallScore}/100`);
console.log(`موفق/نسبی/ناموفق: ${s.counts.pass} / ${s.counts.partial} / ${s.counts.fail}`);
console.log(`انطباق با انتظار: ${s.dimensions.expectation ?? "—"}/10`);
console.log(`وفاداری به منبع:  ${s.dimensions.faithfulness ?? "—"}/10`);
console.log(`ایمنی و گاردریل:  ${s.dimensions.safety ?? "—"}/10`);
console.log(`لحن برند:         ${s.dimensions.brandVoice ?? "—"}/10`);
console.log(`تأخیر میانگین:    ${(s.latency.avgMs / 1000).toFixed(1)}s  (p95: ${(s.latency.p95Ms / 1000).toFixed(1)}s)`);
console.log(`شکاف دانش:        ${s.knowledgeGaps} کیس`);
console.log(`هزینه‌ی داوری:    $${s.judgeCostUsd.toFixed(4)}  (${s.judgeTokens.in + s.judgeTokens.out} توکن)`);
console.log(`زمان اجرا:        ${((Date.now() - started) / 1000).toFixed(0)}s`);
console.log("─".repeat(60));

/* ── ذخیره‌ی خروجی ───────────────────────────────────────── */
const outDir = path.join(ROOT, "reports");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const base = path.join(outDir, `run-${stamp}`);

writeFileSync(`${base}.json`, JSON.stringify(run, null, 2), "utf8");
writeFileSync(`${base}.md`, toMarkdown(run), "utf8");
console.log(`\n📄 ${path.relative(ROOT, base)}.json`);
console.log(`📄 ${path.relative(ROOT, base)}.md\n`);

/* ── گزارش Markdown ──────────────────────────────────────── */
function toMarkdown(run) {
  const s = run.summary;
  const L = [];
  L.push(`# گزارش ارزیابی — ${run.suiteTitle}`);
  L.push("");
  L.push(`> اجرای خودکار با آرکان‌ایوال. این فایل توسط \`npm run eval\` تولید شده است.`);
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| تاریخ | ${run.createdAt} |`);
  L.push(`| هدف | ${run.targetLabel} |`);
  L.push(`| مدل داور | \`${run.judgeModel}\` |`);
  L.push(`| تعداد کیس | ${run.results.length} |`);
  if (run.label) L.push(`| برچسب | ${run.label} |`);
  L.push("");
  L.push(`## خلاصه‌ی مدیریتی`);
  L.push("");
  L.push(`**نمره‌ی کل: ${s.overallScore}/100**`);
  L.push("");
  L.push(`- ✅ موفق: ${s.counts.pass}`);
  L.push(`- ⚠️ نسبی: ${s.counts.partial}`);
  L.push(`- ❌ ناموفق: ${s.counts.fail}`);
  L.push("");
  L.push(`## نمره‌ی ابعاد`);
  L.push("");
  L.push(`| بُعد | نمره (۰–۱۰) |`);
  L.push(`|---|---|`);
  L.push(`| انطباق با انتظار | ${s.dimensions.expectation ?? "—"} |`);
  L.push(`| وفاداری به منبع | ${s.dimensions.faithfulness ?? "—"} |`);
  L.push(`| ایمنی و گاردریل | ${s.dimensions.safety ?? "—"} |`);
  L.push(`| لحن برند | ${s.dimensions.brandVoice ?? "—"} |`);
  L.push("");
  L.push(`## تفکیک دسته‌ای`);
  L.push("");
  L.push(`| دسته | نمره | ✅ | ⚠️ | ❌ |`);
  L.push(`|---|---|---|---|---|`);
  for (const c of s.byCategory) {
    L.push(`| ${c.category} | ${c.score} | ${c.counts.pass} | ${c.counts.partial} | ${c.counts.fail} |`);
  }
  L.push("");
  L.push(`## معیارهای عملیاتی`);
  L.push("");
  L.push(`- تأخیر میانگین: ${(s.latency.avgMs / 1000).toFixed(1)} ثانیه`);
  L.push(`- تأخیر p95: ${(s.latency.p95Ms / 1000).toFixed(1)} ثانیه`);
  L.push(`- بیشترین تأخیر: ${(s.latency.maxMs / 1000).toFixed(1)} ثانیه`);
  L.push(`- شکاف دانش (کیس بدون منبع بازیابی‌شده): ${s.knowledgeGaps}`);
  L.push(`- هزینه‌ی داوری: $${s.judgeCostUsd.toFixed(4)} (${s.judgeTokens.in} ورودی + ${s.judgeTokens.out} خروجی)`);
  L.push("");

  const failures = run.results.filter((r) => r.verdict !== "pass");
  if (failures.length) {
    L.push(`## کیس‌های نیازمند توجه`);
    L.push("");
    for (const r of failures) {
      L.push(`### ${ICON[r.verdict]} \`${r.caseId}\` — ${r.question}`);
      L.push("");
      L.push(`**نمره:** ${r.finalScore}/100 · **دسته:** ${r.category}`);
      L.push("");
      if (r.error) L.push(`**خطا:** ${r.error}`);
      L.push(`**پاسخ بات:**`);
      L.push("");
      L.push("> " + (r.answer || "(خالی)").replace(/\n+/g, "\n> ").slice(0, 900));
      L.push("");
      if (r.expectation) L.push(`**داور انطباق:** ${r.expectation.reasoning}`);
      if (r.faithfulness?.unsupportedClaims?.length) {
        L.push(`**ادعاهای بی‌پشتوانه:** ${r.faithfulness.unsupportedClaims.join(" · ")}`);
      }
      if (r.brandVoice?.violations?.length) {
        L.push(`**تخلف لحن:** ${r.brandVoice.violations.join(" · ")}`);
      }
      if (r.checks.bannedPhrases.length) {
        L.push(`**عبارت ممنوعه:** ${r.checks.bannedPhrases.join(" · ")}`);
      }
      L.push("");
    }
  }

  L.push(`## همه‌ی کیس‌ها`);
  L.push("");
  L.push(`| کیس | حکم | نمره | تأخیر | منابع | سؤال |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const r of run.results) {
    L.push(
      `| \`${r.caseId}\` | ${ICON[r.verdict]} ${VERDICT_LABELS[r.verdict]} | ${r.finalScore} | ${(r.latencyMs / 1000).toFixed(1)}s | ${r.checks.sourceCount} | ${r.question.slice(0, 50)} |`
    );
  }
  L.push("");
  return L.join("\n");
}
