import { randomUUID } from "node:crypto";
import { z } from "zod";
import { computeAlignment } from "@/lib/alignment";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { VERDICTS } from "@/lib/types";

export const dynamic = "force-dynamic";

/** ثبت برچسب انسانی روی یک کیس — ورودی متا-ارزیابی داور. */
const BodySchema = z.object({
  runId: z.string().min(1),
  caseId: z.string().min(1),
  humanVerdict: z.enum(VERDICTS),
  judgeVerdict: z.enum(VERDICTS),
  note: z.string().max(1000).default(""),
});

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return Response.json({ error: `ورودی نامعتبر: ${(e as Error).message}` }, { status: 400 });
  }

  await getStore().saveLabel({
    id: randomUUID(),
    ...body,
    createdAt: new Date().toISOString(),
  });

  const labels = await getStore().listLabels();
  return Response.json({ ok: true, alignment: computeAlignment(labels) });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized();

  const runId = new URL(req.url).searchParams.get("runId") ?? undefined;
  const labels = await getStore().listLabels(runId);
  // هم‌خوانی همیشه روی *همه‌ی* برچسب‌ها حساب می‌شود، نه فقط این اجرا —
  // نمونه‌ی بزرگ‌تر، تخمین بهتر.
  const all = runId ? await getStore().listLabels() : labels;
  return Response.json({ labels, alignment: computeAlignment(all) });
}
