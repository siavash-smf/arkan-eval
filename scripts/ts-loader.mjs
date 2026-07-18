/**
 * لودر حداقلی برای اجرای مستقیم فایل‌های TypeScript در Node.
 *
 * Node از نسخه‌ی ۲۳٫۶ به بعد خودش نوع‌ها را حذف می‌کند و .ts را اجرا می‌کند،
 * اما resolver استاندارد ESM پسوند را اجباری می‌داند. کد ما مثل هر پروژه‌ی
 * TypeScript دیگری بدون پسوند import می‌کند (`from "./types"`).
 *
 * این هوک همان شکاف را پر می‌کند: اگر مسیر نسبی بدون پسوند بود،
 * اول `.ts` و بعد `/index.ts` را امتحان می‌کند.
 *
 * فقط برای اسکریپت CLI لازم است؛ Next.js خودش این را حل می‌کند.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const base = new URL(specifier, pathToFileURL(parent));
    const candidates = [`${base.pathname}.ts`, `${base.pathname}/index.ts`];

    for (const candidate of candidates) {
      const decoded = decodeURIComponent(candidate);
      if (existsSync(decoded)) {
        return { url: pathToFileURL(decoded).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
