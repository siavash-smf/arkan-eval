import { isAuthorized, unauthorized } from "@/lib/auth";
import { getProductionStats } from "@/lib/production";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized();

  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const stats = await getProductionStats(Number.isFinite(days) ? days : 30);
  return Response.json({ stats });
}
