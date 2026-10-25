import { createHmac } from "node:crypto";
import { leadWebhookReady } from "@/lib/gateway";
import type { Env } from "@/lib/runtime-mode";
import type { LeadInput } from "@/lib/lead/types";

export function buildWebhookBody(input: {
  subKey: string;
  occurredAt: string;
  lead: LeadInput;
  recordUrl?: string;
  includeContact: boolean;
}): string {
  const payload: Record<string, string> = {
    event: "lead.received",
    event_id: input.subKey,
    occurred_at: input.occurredAt,
    form_variant: input.lead.form_variant,
    source: input.lead.source,
    project_type: input.lead.project_type,
    timeline: input.lead.timeline,
  };
  if (input.recordUrl) payload.hubspot_record_url = input.recordUrl;
  if (input.includeContact) {
    payload.email = input.lead.email;
    payload.first_name = input.lead.first_name;
  }
  return JSON.stringify(payload);
}

export function signWebhook(secret: string, timestamp: string, rawBody: string): string {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

export function webhookGate(env: Env): { enabled: boolean; reason: "webhook_disabled" | "webhook_misconfigured" | "ready" } {
  const url = (env.LEAD_WEBHOOK_URL || "").trim();
  if (!url && env.LEAD_WEBHOOK_AUTHORIZED !== "true" && !(env.LEAD_WEBHOOK_SECRET || "")) return { enabled: false, reason: "webhook_disabled" };
  if (!leadWebhookReady(env)) return { enabled: false, reason: "webhook_misconfigured" };
  return { enabled: true, reason: "ready" };
}
