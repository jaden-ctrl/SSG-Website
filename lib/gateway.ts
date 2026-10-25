import "server-only";
import { currentDecision, type Env, type ModeDecision, PRODUCTION_HUBSPOT_PORTAL_ID } from "@/lib/runtime-mode";

/**
 * The only server module allowed to call HubSpot, OpenAI, Resend, or an
 * outbound webhook. Adapters pass a channel and a path; this module decides
 * whether the call is mocked, sent with test credentials, or sent for real.
 */

export type OutboundChannel = "hubspot" | "resend" | "webhook" | "openai";

export type OutboundInput = {
  channel: OutboundChannel;
  path?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  recipients?: string[];
  idempotencyKey?: string;
  policy?: "lead" | "legacy-ssgai";
};

const HOSTS = {
  hubspot: "api.hubapi.com",
  resend: "api.resend.com",
  openai: "api.openai.com",
} as const;

export const hubspotOrigin = `https://${HOSTS.hubspot}`;
export const resendOrigin = `https://${HOSTS.resend}`;
export const openaiOrigin = `https://${HOSTS.openai}`;

export class LiveTestBlockedError extends Error {
  readonly code = "production_portal";
  constructor() {
    super("live_test_blocked");
    this.name = "LiveTestBlockedError";
  }
}

export function paidAiAllowed(decision: ModeDecision): boolean {
  return decision.mode === "live" && decision.block == null;
}

export function leadWebhookReady(env: Env): boolean {
  const url = (env.LEAD_WEBHOOK_URL || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
  if (env.LEAD_WEBHOOK_AUTHORIZED !== "true") return false;
  return (env.LEAD_WEBHOOK_SECRET || "").length >= 32;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "X-SSG-Outbound": "mock" } });
}

function mockResponse(input: OutboundInput): Response {
  if (input.channel === "webhook") return new Response(null, { status: 204, headers: { "X-SSG-Outbound": "mock" } });
  if (input.channel === "resend") return jsonResponse({ id: "mock-email", mocked: true });
  if (input.channel === "openai") return jsonResponse({ id: "mock-openai", mocked: true });
  const path = input.path || "";
  if (path.includes("/search") || path.includes("/associations/")) return jsonResponse({ results: [] });
  return jsonResponse({ id: "mock-object", properties: {}, mocked: true });
}

function testRecipientsAllowed(recipients: string[] | undefined, env: Env): boolean {
  const allowed = (env.NOTIFY_EMAIL_TEST_TO || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || !recipients?.length) return false;
  return recipients.every((recipient) => allowed.includes(recipient.trim().toLowerCase()));
}

function safeHttpsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function channelUrl(input: OutboundInput): URL | null {
  if (input.channel === "webhook") return safeHttpsUrl(input.url);
  const host = HOSTS[input.channel];
  const path = input.path || "/";
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return safeHttpsUrl(`https://${host}${path}`);
}

function logOutbound(event: string, channel: OutboundChannel, mode: string) {
  console.info(JSON.stringify({ event, channel, mode }));
}

export async function dispatchOutbound(input: OutboundInput, decision: ModeDecision, env: Env = process.env): Promise<Response> {
  if (decision.block === "production_portal") {
    logOutbound("outbound_blocked", input.channel, "blocked");
    throw new LiveTestBlockedError();
  }

  if (decision.mode === "mock") {
    logOutbound("outbound_mocked", input.channel, "mock");
    return mockResponse(input);
  }

  if (input.channel === "openai" && decision.mode !== "live") {
    logOutbound("outbound_mocked", input.channel, decision.mode);
    return mockResponse(input);
  }

  if (input.channel === "webhook") {
    if (decision.mode !== "live") {
      logOutbound("outbound_mocked", "webhook", decision.mode);
      return mockResponse(input);
    }
    if (input.policy !== "legacy-ssgai" && !leadWebhookReady(env)) {
      logOutbound("outbound_mocked", "webhook", "webhook_disabled");
      return mockResponse(input);
    }
  }

  if (input.channel === "resend" && decision.mode === "live-test" && !testRecipientsAllowed(input.recipients, env)) {
    logOutbound("outbound_mocked", "resend", "recipient_not_allowlisted");
    return mockResponse(input);
  }

  const url = channelUrl(input);
  if (!url) {
    logOutbound("outbound_mocked", input.channel, "url_rejected");
    return mockResponse(input);
  }
  if (input.channel === "webhook" && (url.hostname === HOSTS.hubspot || url.hostname === HOSTS.openai || url.hostname === HOSTS.resend)) {
    logOutbound("outbound_mocked", "webhook", "url_rejected");
    return mockResponse(input);
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(input.headers || {})) {
    if (key.toLowerCase() === "authorization") continue;
    headers.set(key, value);
  }
  if (!headers.has("content-type") && input.body) headers.set("content-type", "application/json");

  if (input.channel === "hubspot") {
    const token = decision.mode === "live" ? env.HUBSPOT_ACCESS_TOKEN : env.HUBSPOT_TEST_ACCESS_TOKEN;
    if (!token || (decision.mode === "live-test" && (env.HUBSPOT_TEST_PORTAL_ID || "").trim() === PRODUCTION_HUBSPOT_PORTAL_ID)) {
      logOutbound("outbound_blocked", "hubspot", decision.mode);
      if (decision.mode === "live-test") throw new LiveTestBlockedError();
      return jsonResponse({ mocked: true, id: "mock-object", results: [] }, 503);
    }
    if (decision.mode === "live-test" && token === env.HUBSPOT_ACCESS_TOKEN) {
      logOutbound("outbound_blocked", "hubspot", "live-test");
      throw new LiveTestBlockedError();
    }
    headers.set("authorization", `Bearer ${token}`);
  }

  if (input.channel === "resend") {
    const key = decision.mode === "live" ? env.RESEND_API_KEY : env.RESEND_TEST_API_KEY;
    if (!key) {
      logOutbound("outbound_mocked", "resend", "unconfigured");
      return mockResponse(input);
    }
    headers.set("authorization", `Bearer ${key}`);
    if (input.idempotencyKey) headers.set("Idempotency-Key", input.idempotencyKey.slice(0, 256));
  }

  if (input.channel === "openai") {
    const key = env.OPENAI_API_KEY;
    if (!key || decision.mode !== "live") {
      logOutbound("outbound_mocked", "openai", decision.mode);
      return mockResponse(input);
    }
    headers.set("authorization", `Bearer ${key}`);
  }

  logOutbound("outbound_fetch", input.channel, decision.mode);
  return fetch(url, {
    method: input.method || "GET",
    headers,
    body: input.body,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(input.timeoutMs ?? 8_000),
  });
}

export async function outboundFetch(input: OutboundInput): Promise<Response> {
  return dispatchOutbound(input, currentDecision(), process.env);
}
