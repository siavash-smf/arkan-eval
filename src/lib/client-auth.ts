"use client";

/**
 * نگه‌داری رمز داشبورد سمت کلاینت.
 *
 * همان الگوی فاز ۳ (STUDIO_PASSWORD): رمز در localStorage می‌ماند و روی
 * هر درخواست به‌صورت هدر فرستاده می‌شود.
 *
 * ⚠️ این احراز هویت واقعی نیست — یک رمز مشترک است، نه کاربر و نشست.
 * هدفش هم امنیت داده نیست، بلکه جلوگیری از **هزینه‌ی ناخواسته** است:
 * دکمه‌ی «شروع ارزیابی» با کلید OpenRouter شما پول خرج می‌کند، و روی
 * اینترنت عمومی نباید در دسترس همه باشد.
 *
 * برای محصول واقعی، احراز هویت درست (مثل فاز ۴) لازم است.
 */

const KEY = "arkan-eval-password";

export function getPassword(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
}

export function setPassword(value: string): void {
  window.localStorage.setItem(KEY, value);
}

export function clearPassword(): void {
  window.localStorage.removeItem(KEY);
}

/** جایگزین fetch که رمز را خودکار ضمیمه می‌کند. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const password = getPassword();
  const headers = new Headers(init?.headers);
  if (password) headers.set("x-eval-password", password);
  return fetch(input, { ...init, headers });
}
