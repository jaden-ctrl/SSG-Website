import { connect as tlsConnect } from "node:tls";
import { currentDecision, type Env, type ModeDecision, PRODUCTION_HUBSPOT_PORTAL_ID } from "./runtime-mode";

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
  policy?: "lead";
};

const HOSTS = {
  hubspot: "api.hubapi.com",
  resend: "api.resend.com",
  openai: "api.openai.com",
} as const;

export const hubspotOrigin = `https://${HOSTS.hubspot}`;
export const resendOrigin = `https://${HOSTS.resend}`;
export const openaiOrigin = `https://${HOSTS.openai}`;
export const HUBSPOT_ACCOUNT_INFO_PATH = "/account-info/v3/details";

export type LiveTestBlockCode = "production_portal" | "portal_unverified" | "production_mismatch";

export class LiveTestBlockedError extends Error {
  readonly code: LiveTestBlockCode;
  constructor(code: LiveTestBlockCode = "production_portal") {
    super("live_test_blocked");
    this.name = "LiveTestBlockedError";
    this.code = code;
  }
}

export const PORTAL_CACHE_TTL_MS = 10 * 60 * 1000;

type PortalCacheEntry = { portal: string; expiresAt: number };

const verifiedPortals = new Map<string, PortalCacheEntry>();
let portalNow = () => Date.now();

export function resetLiveTestPortalCache() {
  verifiedPortals.clear();
  portalNow = () => Date.now();
}

/** Tests advance this clock. A verified portal is trusted for PORTAL_CACHE_TTL_MS only. */
export function setPortalCacheNow(now: () => number) {
  portalNow = now;
}

function cachedPortal(key: string): string | null {
  const entry = verifiedPortals.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= portalNow()) {
    verifiedPortals.delete(key);
    return null;
  }
  return entry.portal;
}

function rememberPortal(key: string, portal: string) {
  verifiedPortals.set(key, { portal, expiresAt: portalNow() + PORTAL_CACHE_TTL_MS });
}

/** The account-info read is the only HubSpot call allowed before a portal proof. */
export function isPortalProof(input: OutboundInput): boolean {
  const method = (input.method || "GET").toUpperCase();
  return method === "GET" && input.path === HUBSPOT_ACCOUNT_INFO_PATH && !input.body;
}

function portalIdOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const value = record.portalId ?? record.hub_id;
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return null;
}

/**
 * Live-test HubSpot writes must prove the test token's portal. A read of
 * account-info is the only call allowed before that proof. The production
 * portal, a mismatch with HUBSPOT_TEST_PORTAL_ID, or an unreadable response
 * blocks every later write.
 */
export async function assertLiveTestPortal(decision: ModeDecision, env: Env = process.env): Promise<void> {
  const declared = (env.HUBSPOT_TEST_PORTAL_ID || "").trim();
  const token = (env.HUBSPOT_TEST_ACCESS_TOKEN || "").trim();
  const declaredProduction = declared === PRODUCTION_HUBSPOT_PORTAL_ID;
  const sameAsProduction = Boolean(token) && token === (env.HUBSPOT_ACCESS_TOKEN || "");
  if (!declared || !token || declaredProduction || sameAsProduction) {
    throw new LiveTestBlockedError(declaredProduction || sameAsProduction ? "production_portal" : "portal_unverified");
  }
  const cacheKey = `live-test\n${token}\n${declared}`;
  const cached = cachedPortal(cacheKey);
  if (cached) {
    if (cached === PRODUCTION_HUBSPOT_PORTAL_ID) throw new LiveTestBlockedError("production_portal");
    if (cached !== declared) throw new LiveTestBlockedError("portal_unverified");
    return;
  }
  const portal = await readAccountPortal(decision, env);
  if (portal === PRODUCTION_HUBSPOT_PORTAL_ID) throw new LiveTestBlockedError("production_portal");
  if (portal !== declared) throw new LiveTestBlockedError("portal_unverified");
  rememberPortal(cacheKey, portal);
}

/**
 * Live production writes must prove the production token belongs to portal
 * 246622244. A mismatch or an unreadable account-info response blocks the write.
 * Failures are not cached.
 */
export async function assertProductionPortal(decision: ModeDecision, env: Env = process.env): Promise<void> {
  const token = (env.HUBSPOT_ACCESS_TOKEN || "").trim();
  if (!token) throw new LiveTestBlockedError("portal_unverified");
  const cacheKey = `live\n${token}\n${PRODUCTION_HUBSPOT_PORTAL_ID}`;
  const cached = cachedPortal(cacheKey);
  if (cached) {
    if (cached !== PRODUCTION_HUBSPOT_PORTAL_ID) throw new LiveTestBlockedError("production_mismatch");
    return;
  }
  const portal = await readAccountPortal(decision, env);
  if (portal !== PRODUCTION_HUBSPOT_PORTAL_ID) throw new LiveTestBlockedError("production_mismatch");
  rememberPortal(cacheKey, portal);
}

async function readAccountPortal(decision: ModeDecision, env: Env): Promise<string> {
  let response: Response;
  try {
    response = await dispatchOutbound({
      channel: "hubspot",
      path: HUBSPOT_ACCOUNT_INFO_PATH,
      method: "GET",
    }, decision, env);
  } catch (error) {
    if (error instanceof LiveTestBlockedError) throw error;
    throw new LiveTestBlockedError("portal_unverified");
  }
  if (!response.ok || response.headers.get("X-SSG-Outbound") === "mock") throw new LiveTestBlockedError("portal_unverified");
  const portal = portalIdOf(await response.json().catch(() => null));
  if (!portal) throw new LiveTestBlockedError("portal_unverified");
  return portal;
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
  if (decision.block) {
    logOutbound("outbound_blocked", input.channel, "blocked");
    throw new LiveTestBlockedError(decision.block === "production_portal" ? "production_portal" : "portal_unverified");
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
    if (!leadWebhookReady(env)) {
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
    if (!isPortalProof(input)) {
      try {
        if (decision.mode === "live") await assertProductionPortal(decision, env);
        if (decision.mode === "live-test") await assertLiveTestPortal(decision, env);
      } catch (error) {
        if (error instanceof LiveTestBlockedError) {
          console.error(JSON.stringify({
            event: decision.mode === "live" ? "lead_production_portal_blocked" : "lead_live_test_blocked",
            reason: error.code,
          }));
        }
        throw error;
      }
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
    // The Agents SDK was removed. Any future live call still has to present a key here.
    const key = (env.OPENAI_API_KEY || "").trim();
    if (!key || decision.mode !== "live") {
      logOutbound("outbound_mocked", "openai", key ? decision.mode : "missing_key");
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

export async function outboundFetch(input: OutboundInput, decision = currentDecision(), env: Env = process.env): Promise<Response> {
  return dispatchOutbound(input, decision, env);
}

export type SmtpMessage = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
};

export async function outboundSmtp(message: SmtpMessage, decision = currentDecision()): Promise<{ id: string; mocked: boolean }> {
  if (decision.block) throw new LiveTestBlockedError();
  if (decision.mode !== "live") return { id: "mock-smtp", mocked: true };
  const id = await deliverSmtp(message);
  console.info(JSON.stringify({ event: "outbound_fetch", channel: "smtp", mode: "live" }));
  return { id, mocked: false };
}

function deliverSmtp(message: SmtpMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host: message.host, port: message.port, servername: message.host }, () => {
      const pending: Buffer[] = [];
      const read = () => new Promise<string>((done, fail) => {
        const take = () => {
          const text = Buffer.concat(pending).toString("utf8");
          if (/(^|\n)\d{3} /.test(text)) {
            pending.length = 0;
            done(text);
          }
        };
        socket.on("data", (chunk) => { pending.push(chunk); take(); });
        socket.once("error", fail);
        take();
      });
      const write = async (line: string) => {
        socket.write(`${line}\r\n`);
        const reply = await read();
        if (!/^[23]\d\d/m.test(reply)) throw new Error("smtp_rejected");
        return reply;
      };
      void (async () => {
        try {
          await read();
          await write("EHLO ssg.local");
          await write("AUTH LOGIN");
          await write(Buffer.from(message.user).toString("base64"));
          await write(Buffer.from(message.pass).toString("base64"));
          await write(`MAIL FROM:<${message.from.match(/<([^>]+)>/)?.[1] || message.from}>`);
          for (const recipient of message.to) await write(`RCPT TO:<${recipient}>`);
          await write("DATA");
          socket.write(`Subject: ${message.subject.replace(/[\r\n]/g, " ")}\r\nTo: ${message.to.join(", ")}\r\nFrom: ${message.from}\r\n\r\n${message.text.replace(/\n\./g, "\n..")}\r\n.\r\n`);
          const reply = await read();
          if (!/^250/m.test(reply)) throw new Error("smtp_rejected");
          socket.end("QUIT\r\n");
          resolve(`smtp-${Date.now()}`);
        } catch (error) {
          socket.destroy();
          reject(error instanceof Error ? error : new Error("smtp_failed"));
        }
      })();
    });
    socket.once("error", () => reject(new Error("smtp_failed")));
  });
}
