import { isAuthorized, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized();

  const runs = await getStore().listRuns(30);
  // نتایج کامل را در لیست نمی‌فرستیم — فقط خلاصه. صفحه‌ی جزئیات
  // خودش کل اجرا را می‌گیرد.
  return Response.json({
    runs: runs.map(({ results, ...rest }) => ({ ...rest, caseCount: results.length })),
  });
}
