import { isAuthorized, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) return unauthorized();

  const run = await getStore().getRun(params.id);
  if (!run) return Response.json({ error: "اجرا پیدا نشد." }, { status: 404 });
  return Response.json({ run });
}
