export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** اعداد لاتین را به فارسی تبدیل می‌کند — برای نمایش در متن. */
export function faNum(v: number | string): string {
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  return String(v).replace(/\d/g, (d) => digits[Number(d)]);
}

export function pct(v: number, digits = 0): string {
  return `${faNum(v.toFixed(digits))}٪`;
}

export function ms(v: number): string {
  if (v < 1000) return `${faNum(Math.round(v))} میلی‌ثانیه`;
  return `${faNum((v / 1000).toFixed(1))} ثانیه`;
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "همین حالا";
  if (min < 60) return `${faNum(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${faNum(hr)} ساعت پیش`;
  return `${faNum(Math.floor(hr / 24))} روز پیش`;
}

/** صدک — برای p95 تأخیر. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
