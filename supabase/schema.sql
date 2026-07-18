-- ═══════════════════════════════════════════════════════════
-- آرکان‌ایوال — اسکیمای دیتابیس
--
-- این فایل را در SQL Editor پروژه‌ی Supabase خود اجرا کنید.
-- (اختیاری است: بدون آن، پروژه روی حافظه کار می‌کند و با
--  ری‌استارت نتایج پاک می‌شوند.)
--
-- ⚠️ توجه امنیتی — همان الگوی فازهای قبلی آرکان:
-- RLS روی هر دو جدول فعال است و هیچ policy تعریف نشده.
-- این عمدی است: یعنی کلاینت anon هیچ چیزی نمی‌بیند و تمام
-- دسترسی از سمت سرور با SUPABASE_SERVICE_ROLE_KEY انجام می‌شود
-- (که RLS را دور می‌زند). اگر روزی کلاینت anon اضافه کردید،
-- حتماً policy هم بنویسید وگرنه هیچ داده‌ای برنمی‌گردد.
-- ═══════════════════════════════════════════════════════════

-- ── جدول ۱: اجراهای ارزیابی ────────────────────────────────
-- تصمیم طراحی: results و summary به‌صورت jsonb ذخیره می‌شوند،
-- نه در جدول جداگانه با یک ردیف به‌ازای هر کیس.
-- دلیل: هرگز روی تک‌کیس کوئری نمی‌زنیم؛ همیشه کل گزارش را با هم
-- می‌خوانیم. نرمال‌سازی اینجا فقط پیچیدگی اضافه می‌کرد.
-- (اگر روزی خواستید روی کیس‌ها فیلتر و تجمیع بزنید، آن‌وقت
--  وقتِ شکستن این ستون به جدول جداست.)

create table if not exists public.eval_runs (
  id          uuid primary key,
  status      text not null check (status in ('running', 'done', 'error')),
  created_at  timestamptz not null default now(),
  finished_at timestamptz,

  suite_id    text not null,
  suite_title text not null,

  target_id    text not null,
  target_label text not null,

  judge_model text not null,
  label       text default '',

  progress jsonb not null default '{"done":0,"total":0}'::jsonb,
  results  jsonb not null default '[]'::jsonb,
  summary  jsonb,
  error    text
);

create index if not exists eval_runs_created_at_idx
  on public.eval_runs (created_at desc);

create index if not exists eval_runs_suite_idx
  on public.eval_runs (suite_id, created_at desc);

alter table public.eval_runs enable row level security;


-- ── جدول ۲: برچسب‌های انسانی (متا-ارزیابی داور) ────────────
-- اینجاست که «داورِ داور» زندگی می‌کند. هر ردیف یعنی یک انسان
-- روی یک کیس نظر داده، و ما حکم داور را کنارش نگه داشته‌ایم تا
-- بتوانیم هم‌خوانی را حساب کنیم.
--
-- قید یکتایی (run_id, case_id): هر کیس در هر اجرا فقط یک برچسب
-- انسانی دارد. برچسب جدید جای قبلی را می‌گیرد (upsert).

create table if not exists public.eval_human_labels (
  id            uuid primary key,
  run_id        uuid not null references public.eval_runs (id) on delete cascade,
  case_id       text not null,
  human_verdict text not null check (human_verdict in ('pass', 'partial', 'fail')),
  judge_verdict text not null check (judge_verdict in ('pass', 'partial', 'fail')),
  note          text default '',
  created_at    timestamptz not null default now(),

  unique (run_id, case_id)
);

create index if not exists eval_human_labels_run_idx
  on public.eval_human_labels (run_id);

alter table public.eval_human_labels enable row level security;
