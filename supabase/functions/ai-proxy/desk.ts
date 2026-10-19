// Desk agent turn. Auth, the plan gate, and the rate-limit row happen in
// index.ts before this runs. This file loads one user's leads, lets the model
// call tools, then drops any sentence that does not cite a tool result.

import { json } from "../_shared/http.ts";
import {
  DESK_SYSTEM,
  DESK_TOOLS,
  buildDeskUserMessage,
  executeTool,
  finishDeskTurn,
  wantsSend,
} from "../_shared/deskAgent.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 4;

function camelLead(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    btype: row.btype,
    city: row.city,
    country: row.country,
    website: row.website,
    phone: row.phone,
    status: row.status,
    score: row.score,
    findings: row.findings || [],
    siteMeasurement: row.site_measurement || null,
    watchLog: row.watch_log || [],
    lastWatchAt: row.last_watch_at || null,
    benchmark: row.benchmark || null,
    auditedAt: row.audited_at || null,
    followUpDate: row.follow_up_date || null,
    serviceId: row.service_id || null,
  };
}

async function callModel(apiKey: string, messages: unknown[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: DESK_SYSTEM,
      tools: DESK_TOOLS,
      messages,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  return res;
}

export async function handleDeskAgent(
  req: Request,
  supabase: any,
  profile: { id: string },
  params: Record<string, any>,
  apiKey: string,
) {
  const message = String(params?.message || "").trim();
  if (!message) return json(req, { error: "Type a question first." }, 400);
  if (message.length > 2000) return json(req, { error: "That question is too long." }, 400);

  if (wantsSend(message)) {
    const refused = finishDeskTurn({ message, modelText: "", sawSendTool: false });
    return json(req, refused);
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id,name,btype,city,country,website,phone,status,score,findings,site_measurement,watch_log,last_watch_at,benchmark,audited_at,follow_up_date,service_id")
    .eq("user_id", profile.id)
    .limit(200);

  if (error) {
    console.error("desk leads failed:", error.message);
    return json(req, { error: "Could not read your desk.", fallback: true }, 503);
  }

  const leads = (data || []).map(camelLead);
  const ctx = { leads, citations: [] as any[], actions: [] as any[] };
  const history = Array.isArray(params?.history) ? params.history.slice(-6) : [];
  const messages: any[] = [{ role: "user", content: buildDeskUserMessage(message, history) }];
  let modelText = "";
  let sawSendTool = false;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await callModel(apiKey, messages);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Anthropic desk error", res.status);
        const status = res.status === 429 || res.status === 529 ? 429 : 502;
        return json(req, {
          error: status === 429
            ? "AI is busy right now — try again in a few seconds."
            : "AI request failed.",
          fallback: true,
        }, status);
      }
      inputTokens += body.usage?.input_tokens ?? 0;
      outputTokens += body.usage?.output_tokens ?? 0;
      const content = Array.isArray(body.content) ? body.content : [];
      modelText = content.filter((block: any) => block.type === "text").map((block: any) => block.text || "").join("\n");
      const toolUses = content.filter((block: any) => block.type === "tool_use");
      if (!toolUses.length) break;

      messages.push({ role: "assistant", content });
      const results = [];
      for (const use of toolUses) {
        if (/send|email|mail|dispatch/i.test(String(use.name || ""))) sawSendTool = true;
        const payload = executeTool(use.name, use.input || {}, ctx);
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(payload),
        });
      }
      messages.push({ role: "user", content: results });
      if (sawSendTool) break;
    }
  } catch (err) {
    console.error("desk agent failed:", err);
    return json(req, { error: "AI service unreachable. Try again.", fallback: true }, 502);
  }

  supabase.rpc("record_ai_tokens", {
    p_user_id: profile.id,
    p_input: inputTokens,
    p_output: outputTokens,
  }).then(undefined, () => {});

  const finished = finishDeskTurn({
    message,
    modelText,
    citations: ctx.citations,
    actions: ctx.actions,
    sawSendTool,
    leadNames: leads.map((lead: any) => lead.name),
  });
  return json(req, finished);
}
