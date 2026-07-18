import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { PasswordGate } from "@/components/PasswordGate";
import { authEnabled } from "@/lib/auth";
import "./globals.css";

const estedad = localFont({
  variable: "--font-estedad",
  display: "swap",
  src: [
    { path: "../../public/fonts/Estedad-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Estedad-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Estedad-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Estedad-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const vazirmatn = localFont({
  variable: "--font-vazirmatn",
  display: "swap",
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "آرکان‌ایوال — سنجش و پایش هوش مصنوعی", template: "%s | آرکان‌ایوال" },
  description:
    "داشبورد ارزیابی خودکار چت‌بات با داور هوش مصنوعی، پایش ترافیک واقعی، و سنجش هزینه.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/", label: "نمای کلی" },
  { href: "/runs", label: "اجراها" },
  { href: "/suites", label: "مجموعه‌ی آزمون" },
  { href: "/production", label: "تولید" },
  { href: "/cost", label: "هزینه" },
  { href: "/judge", label: "داورِ داور" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${estedad.variable} ${vazirmatn.variable}`}>
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-sand/80 bg-bone/90 backdrop-blur">
          <div className="mx-auto flex max-w-content items-center gap-6 px-5 py-3">
            <Link href="/" className="flex items-center gap-2 font-heading font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-btn bg-pine text-bone">
                {/* چهار ستون — نشانه‌ی آرکان */}
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <g fill="currentColor">
                    <rect x="1" y="5" width="2.2" height="9" rx="1" />
                    <rect x="5" y="2" width="2.2" height="12" rx="1" />
                    <rect x="9" y="4" width="2.2" height="10" rx="1" />
                    <rect x="13" y="7" width="2.2" height="7" rx="1" />
                  </g>
                </svg>
              </span>
              آرکان‌ایوال
            </Link>

            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-btn px-3 py-1.5 text-slate transition-colors hover:bg-sand/50 hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {/* جعبه‌ی رمز باید در *همه‌ی* صفحه‌ها باشد، نه فقط صفحه‌ی اصلی.
            قبلاً فقط در صفحه‌ی اصلی بود و کاربری که مستقیم وارد گزارش یک
            اجرا می‌شد، هیچ راهی برای وارد کردن رمز نداشت — درخواست‌هایش
            ۴۰۱ می‌گرفتند بدون اینکه بفهمد چرا. */}
        {authEnabled() && (
          <div className="mx-auto max-w-content px-5 pt-5">
            <PasswordGate enabled />
          </div>
        )}

        <main className="mx-auto max-w-content px-5 py-8">{children}</main>

        <footer className="mx-auto max-w-content px-5 pb-10 pt-4 text-xs text-slate">
          فاز ۵ پروژه‌ی آموزشی آرکان — سنجش و پایش سیستم‌های هوش مصنوعی.
        </footer>
      </body>
    </html>
  );
}
