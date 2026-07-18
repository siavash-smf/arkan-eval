"use client";

import { useEffect, useState } from "react";
import { clearPassword, getPassword, setPassword } from "@/lib/client-auth";

/**
 * جعبه‌ی ورود رمز داشبورد.
 *
 * فقط وقتی نمایش داده می‌شود که سرور گفته باشد رمز فعال است
 * (`authEnabled`). اگر رمز تنظیم نشده باشد، چیزی رندر نمی‌شود.
 */
export function PasswordGate({ enabled }: { enabled: boolean }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  // localStorage فقط سمت کلاینت در دسترس است، پس بعد از mount می‌خوانیم.
  useEffect(() => {
    setSaved(Boolean(getPassword()));
  }, []);

  if (!enabled) return null;

  if (saved) {
    return (
      <div className="card flex flex-wrap items-center gap-3 p-3 text-sm">
        <span className="chip bg-pass/10 text-pass">رمز ثبت شده</span>
        <span className="flex-1 text-slate">درخواست‌های داشبورد با رمز ارسال می‌شوند.</span>
        <button
          className="btn-ghost"
          onClick={() => {
            clearPassword();
            setSaved(false);
          }}
        >
          پاک‌کردن
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h2 className="font-heading text-sm font-semibold">رمز داشبورد لازم است</h2>
      <p className="mt-1 text-xs leading-6 text-slate">
        این داشبورد با رمز محافظت می‌شود چون اجرای ارزیابی با کلید OpenRouter هزینه تولید
        می‌کند. رمز در مرورگر شما ذخیره می‌شود.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          setPassword(value.trim());
          setSaved(true);
          setValue("");
        }}
      >
        <input
          type="password"
          className="field max-w-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="EVAL_PASSWORD"
          autoComplete="current-password"
        />
        <button className="btn-primary" type="submit">
          ثبت
        </button>
      </form>
    </div>
  );
}
