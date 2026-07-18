/**
 * محافظت ساده‌ی داشبورد با یک رمز مشترک در هدر.
 *
 * ⚠️ هشدار آموزشی مهم:
 * اگر EVAL_PASSWORD تنظیم نشده باشد، این تابع true برمی‌گرداند —
 * یعنی داشبورد کاملاً باز است. برای توسعه‌ی محلی راحت است، ولی
 * اگر جایی دیپلوی می‌کنید حتماً پرش کنید.
 *
 * این همان الگوی فاز ۳ (STUDIO_PASSWORD) است، با همان ضعف عمدی.
 * برای محصول واقعی، احراز هویت درست (مثل فاز ۴) لازم است.
 */
export function isAuthorized(req: Request): boolean {
  const expected = process.env.EVAL_PASSWORD;
  if (!expected) return true;
  return req.headers.get("x-eval-password") === expected;
}

export function unauthorized(): Response {
  return Response.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
}

export function authEnabled(): boolean {
  return Boolean(process.env.EVAL_PASSWORD);
}
