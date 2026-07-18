import { createClient } from "@supabase/supabase-js";
import { costUsd } from "./pricing";

/* ────────────────────────────────────────────────────────────
   مانیتورینگ تولید — لایه‌ی دوم ارزیابی.

   گلدن‌ست به ما می‌گوید بات روی سؤال‌هایی که *ما* فکر کردیم مهم‌اند
   چطور عمل می‌کند. ترافیک واقعی چیز دیگری می‌گوید: کاربران واقعاً چه
   می‌پرسند، و کجا بات کم می‌آورد.

   راهنمای ارزیابی می‌گوید ارزشمندترین داده «لیست سؤالات بی‌جواب» است —
   یعنی پیام‌هایی که هیچ منبعی برایشان بازیابی نشد. هر کدامشان یک
   سند تازه برای پایگاه دانش است.

   این ماژول فقط می‌خواند. دیتابیس آرکان را هرگز تغییر نمی‌دهد.
   ──────────────────────────────────────────────────────────── */

export function productionConfigured(): boolean {
  return Boolean(
    process.env.ARKAN_SUPABASE_URL && process.env.ARKAN_SUPABASE_SERVICE_ROLE_KEY
  );
}

function db() {
  const url = process.env.ARKAN_SUPABASE_URL!;
  const key = process.env.ARKAN_SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // مثل store/supabase.ts — جلوگیری از Data Cache نکست.
      // اینجا حتی مهم‌تر است: آمار تولید باید همیشه تازه باشد،
      // وگرنه داشبورد پایش، عکس دیروز را نشان می‌دهد.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

export type ProductionStats = {
  configured: boolean;
  window: { days: number; from: string };
  totals: {
    conversations: number;
    messages: number;
    assistantMessages: number;
    leads: number;
    chatbotLeads: number;
  };
  byChannel: { channel: string; conversations: number }[];
  satisfaction: { up: number; down: number; rate: number | null };
  /** نرخ تبدیل گفتگو به لید — سنجه‌ی کسب‌وکاری، نه فنی. */
  conversionRate: number;
  /** پاسخ‌هایی که هیچ منبعی نداشتند — شکاف دانش. */
  knowledgeGaps: { question: string; when: string }[];
  /** پیام‌هایی که کاربر 👎 داده. */
  negativeFeedback: { answer: string; comment: string; when: string }[];
  cost: {
    byModel: { model: string; messages: number; tokensIn: number; tokensOut: number; costUsd: number }[];
    totalUsd: number;
    totalTokens: number;
    /** هزینه به‌ازای هر لید — عدد نهاییِ مورد علاقه‌ی کارفرما. */
    costPerLeadUsd: number | null;
  };
  error?: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  web: "صفحه‌ی چت",
  widget: "ویجت",
  telegram: "تلگرام",
};

export function channelLabel(ch: string): string {
  return CHANNEL_LABELS[ch] ?? ch;
}

export async function getProductionStats(days = 30): Promise<ProductionStats> {
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  const empty: ProductionStats = {
    configured: false,
    window: { days, from },
    totals: { conversations: 0, messages: 0, assistantMessages: 0, leads: 0, chatbotLeads: 0 },
    byChannel: [],
    satisfaction: { up: 0, down: 0, rate: null },
    conversionRate: 0,
    knowledgeGaps: [],
    negativeFeedback: [],
    cost: { byModel: [], totalUsd: 0, totalTokens: 0, costPerLeadUsd: null },
  };

  if (!productionConfigured()) return empty;

  try {
    const sb = db();

    // سقف روی تعداد ردیف‌ها می‌گذاریم و تجمیع را در JS انجام می‌دهیم.
    // برای مقیاس آموزشی کافی است؛ در مقیاس بزرگ باید به توابع SQL منتقل شود.
    const [convs, msgs, leads, fb] = await Promise.all([
      // ⚠️ جدول conversations ستون created_at ندارد — زمان شروعش `started_at` است.
      // (این را با کوئری روی information_schema پیدا کردیم، بعد از اینکه داشبورد
      //  «۵۴۳ پیام ولی صفر گفتگو» نشان داد.)
      sb.from("conversations").select("id, channel, started_at").gte("started_at", from).limit(5000),
      sb
        .from("messages")
        .select("id, role, content, model_used, tokens_in, tokens_out, retrieved_chunk_ids, conversation_id, created_at")
        .gte("created_at", from)
        .limit(8000),
      sb.from("leads").select("id, source, created_at").gte("created_at", from).limit(5000),
      sb.from("feedback").select("id, rating, comment, message_id, created_at").gte("created_at", from).limit(2000),
    ]);

    // خطای هر کوئری را صریح بالا می‌بریم.
    // درس گران‌قیمت: نسخه‌ی اول این فایل خطاها را با `?? []` می‌بلعید،
    // و وقتی نام یک ستون غلط بود داشبورد به‌جای خطا، عدد صفر نشان داد.
    // «صفرِ دروغین» از «خطای صریح» خیلی خطرناک‌تر است — چون کسی
    // متوجه نمی‌شود که اندازه‌گیری خراب است.
    const failed = [
      ["conversations", convs.error],
      ["messages", msgs.error],
      ["leads", leads.error],
      ["feedback", fb.error],
    ].filter(([, e]) => e) as [string, { message: string }][];

    if (failed.length) {
      throw new Error(
        failed.map(([table, e]) => `${table}: ${e.message}`).join(" · ")
      );
    }

    const conversations = convs.data ?? [];
    const messages = msgs.data ?? [];
    const leadRows = leads.data ?? [];
    const feedback = fb.data ?? [];

    const assistantMsgs = messages.filter((m) => m.role === "assistant");

    // ── تفکیک کانالی ──
    const channelMap = new Map<string, number>();
    conversations.forEach((c) => {
      channelMap.set(c.channel, (channelMap.get(c.channel) ?? 0) + 1);
    });

    // ── رضایت ──
    const up = feedback.filter((f) => f.rating === "up").length;
    const down = feedback.filter((f) => f.rating === "down").length;

    // ── شکاف دانش ──
    // پاسخ دستیار بدون هیچ chunk بازیابی‌شده. سؤالِ کاربر را پیدا
    // می‌کنیم (پیام کاربریِ درست قبل از آن در همان گفتگو).
    const gapMsgs = assistantMsgs.filter(
      (m) => !m.retrieved_chunk_ids || m.retrieved_chunk_ids.length === 0
    );
    const knowledgeGaps = gapMsgs
      .slice(0, 40)
      .map((m) => {
        const prior = messages
          .filter(
            (x) =>
              x.conversation_id === m.conversation_id &&
              x.role === "user" &&
              x.created_at <= m.created_at
          )
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return { question: prior?.content?.slice(0, 200) ?? "(نامشخص)", when: m.created_at };
      })
      .filter((g) => g.question !== "(نامشخص)");

    // ── بازخورد منفی ──
    const msgById = new Map(messages.map((m) => [m.id, m]));
    const negativeFeedback = feedback
      .filter((f) => f.rating === "down")
      .slice(0, 30)
      .map((f) => ({
        answer: msgById.get(f.message_id)?.content?.slice(0, 300) ?? "(پیام یافت نشد)",
        comment: f.comment ?? "",
        when: f.created_at,
      }));

    // ── هزینه به تفکیک مدل ──
    const modelMap = new Map<string, { messages: number; tokensIn: number; tokensOut: number }>();
    assistantMsgs.forEach((m) => {
      const key = m.model_used || "نامشخص";
      const cur = modelMap.get(key) ?? { messages: 0, tokensIn: 0, tokensOut: 0 };
      cur.messages++;
      cur.tokensIn += m.tokens_in ?? 0;
      cur.tokensOut += m.tokens_out ?? 0;
      modelMap.set(key, cur);
    });

    const byModel = Array.from(modelMap.entries())
      .map(([model, v]) => ({
        model,
        ...v,
        costUsd: costUsd(model, { in: v.tokensIn, out: v.tokensOut }),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    const totalUsd = byModel.reduce((a, m) => a + m.costUsd, 0);
    const totalTokens = byModel.reduce((a, m) => a + m.tokensIn + m.tokensOut, 0);
    const chatbotLeads = leadRows.filter((l) => l.source === "chatbot").length;

    return {
      configured: true,
      window: { days, from },
      totals: {
        conversations: conversations.length,
        messages: messages.length,
        assistantMessages: assistantMsgs.length,
        leads: leadRows.length,
        chatbotLeads,
      },
      byChannel: Array.from(channelMap.entries())
        .map(([channel, count]) => ({ channel, conversations: count }))
        .sort((a, b) => b.conversations - a.conversations),
      satisfaction: {
        up,
        down,
        rate: up + down > 0 ? Number(((up / (up + down)) * 100).toFixed(1)) : null,
      },
      conversionRate: conversations.length
        ? Number(((chatbotLeads / conversations.length) * 100).toFixed(1))
        : 0,
      knowledgeGaps,
      negativeFeedback,
      cost: {
        byModel,
        totalUsd,
        totalTokens,
        costPerLeadUsd: chatbotLeads > 0 ? totalUsd / chatbotLeads : null,
      },
    };
  } catch (e) {
    return { ...empty, configured: true, error: (e as Error).message };
  }
}
