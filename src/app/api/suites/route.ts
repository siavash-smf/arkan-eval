import { isAuthorized, unauthorized } from "@/lib/auth";
import { listSuites } from "@/lib/suites";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized();

  const suites = await listSuites();
  // فقط متادیتا برمی‌گردانیم، نه کل کیس‌ها — لیست سبک بماند.
  return Response.json({
    suites: suites.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      caseCount: s.cases.length,
      categories: Array.from(new Set(s.cases.map((c) => c.category))),
    })),
  });
}
