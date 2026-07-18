import { VERDICTS, type HumanLabel, type JudgeAlignment, type Verdict } from "./types";

/* ────────────────────────────────────────────────────────────
   متا-ارزیابی: «چه کسی داور را داوری می‌کند؟»

   این بخش، چیزی است که اکثر پروژه‌های ارزیابی فراموشش می‌کنند.
   ما با یک مدل داریم مدل دیگری را می‌سنجیم — ولی از کجا بدانیم
   خودِ داور درست قضاوت می‌کند؟

   جواب: چند ده کیس را انسان هم برچسب می‌زند، و ما هم‌خوانی داور
   با انسان را اندازه می‌گیریم. اگر هم‌خوانی پایین باشد، همه‌ی
   نمره‌های داشبورد بی‌معنا هستند و باید روبریک داور را درست کنیم.

   نکته: «نرخ توافق» به‌تنهایی گمراه‌کننده است. اگر ۹۰٪ کیس‌ها
   pass باشند، داوری که همیشه pass بگوید ۹۰٪ توافق می‌گیرد بدون
   اینکه چیزی بفهمد. برای همین کاپای کوهن را هم حساب می‌کنیم:
   توافق فراتر از شانس.
   ──────────────────────────────────────────────────────────── */

function emptyMatrix(): Record<Verdict, Record<Verdict, number>> {
  const m = {} as Record<Verdict, Record<Verdict, number>>;
  for (const h of VERDICTS) {
    m[h] = {} as Record<Verdict, number>;
    for (const j of VERDICTS) m[h][j] = 0;
  }
  return m;
}

/**
 * کاپای کوهن.
 *   κ = (p_observed − p_chance) / (1 − p_chance)
 * تفسیر رایج: <۰ بدتر از شانس، ۰٫۲–۰٫۴ ضعیف، ۰٫۴–۰٫۶ متوسط،
 * ۰٫۶–۰٫۸ خوب، >۰٫۸ عالی.
 */
function cohensKappa(
  matrix: Record<Verdict, Record<Verdict, number>>,
  total: number
): number | null {
  if (total === 0) return null;

  const observed = VERDICTS.reduce((a, v) => a + matrix[v][v], 0) / total;

  let chance = 0;
  for (const v of VERDICTS) {
    const humanRow = VERDICTS.reduce((a, j) => a + matrix[v][j], 0) / total;
    const judgeCol = VERDICTS.reduce((a, h) => a + matrix[h][v], 0) / total;
    chance += humanRow * judgeCol;
  }

  if (chance === 1) return null; // تقسیم بر صفر — همه‌ی برچسب‌ها یکسان‌اند
  return Number(((observed - chance) / (1 - chance)).toFixed(3));
}

export function computeAlignment(labels: HumanLabel[]): JudgeAlignment {
  const matrix = emptyMatrix();
  let agreed = 0;

  for (const l of labels) {
    matrix[l.humanVerdict][l.judgeVerdict]++;
    if (l.humanVerdict === l.judgeVerdict) agreed++;
  }

  const total = labels.length;
  return {
    total,
    agreed,
    agreementRate: total ? Number(((agreed / total) * 100).toFixed(1)) : 0,
    matrix,
    cohensKappa: cohensKappa(matrix, total),
  };
}

export function kappaLabel(k: number | null): string {
  if (k === null) return "قابل محاسبه نیست";
  if (k < 0) return "بدتر از شانس";
  if (k < 0.2) return "ناچیز";
  if (k < 0.4) return "ضعیف";
  if (k < 0.6) return "متوسط";
  if (k < 0.8) return "خوب";
  return "عالی";
}
