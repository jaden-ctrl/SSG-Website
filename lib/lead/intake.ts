import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { openJsonStore, privateJsonStore, type JsonStore } from "@/lib/blob-store";
import { LiveTestBlockedError } from "@/lib/gateway";
import type { Crm } from "@/lib/lead/crm";
import { createLiveCrm } from "@/lib/lead/crm";
import { decodeStoreKey, encryptJson, hmacHex } from "@/lib/lead/crypto";
import { logLead } from "@/lib/lead/log";
import type { Mailer } from "@/lib/lead/notify";
import { createMailer } from "@/lib/lead/notify";
import { processSubmission, runDue, type ProcessDeps } from "@/lib/lead/processor";
import { clientIp, enforceRateLimit } from "@/lib/lead/ratelimit";
import { submissionKey } from "@/lib/lead/subkey";
import { emptySteps, type SubmissionRecord } from "@/lib/lead/types";
import { bodyTooLarge, validateLead } from "@/lib/lead/validate";
import { currentDecision, currentRequestHost, productionHosts, type ModeDecision } from "@/lib/runtime-mode";

export type IntakeResult = { status: number; body: Record<string, unknown>; retryAfter?: number };

export type IntakeOptions = {
  now?: () => number;
  env?: NodeJS.ProcessEnv;
  store?: JsonStore;
  crm?: Crm;
  mailer?: Mailer;
  decision?: ModeDecision;
};

function numberEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = Number(env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function received(): IntakeResult {
  return { status: 200, body: { ok: true, status: "received" } };
}

function failed(): IntakeResult {
  return { status: 502, body: { ok: false, error: "Lead submission failed" } };
}

/**
 * Validate, rate-limit, and persist a lead, then run the pipeline.
 * A durable record is written before HubSpot. Without LEAD_STORE_KEY the
 * payload stays in a request-local store and a HubSpot failure is a 502.
 */
export async function acceptLead(raw: string, contentLength: string | null, headers: Headers, options: IntakeOptions = {}): Promise<IntakeResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => Date.now());
  const decision = options.decision ?? currentDecision(env);
  if (decision.mode === "live" && !env.HUBSPOT_ACCESS_TOKEN) {
    return { status: 503, body: { ok: false, error: "Lead system is not configured yet." } };
  }
  if (bodyTooLarge(contentLength, raw)) return { status: 413, body: { ok: false, error: "Please check the form.", fields: [] } };

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return { status: 400, body: { ok: false, error: "Invalid request body", fields: [] } };
  }

  const origins = productionHosts(env).hosts;
  const requestHost = currentRequestHost();
  if (requestHost) origins.push(requestHost);
  const validation = validateLead(parsed, {
    now: now(),
    minFillMs: numberEnv(env, "LEAD_MIN_FILL_MS", 2_500),
    origins,
  });
  if (!validation.ok) return { status: validation.status, body: { ok: false, error: validation.error, fields: validation.fields } };
  if (validation.stripped.length) logLead("info", "lead_unknown_fields_stripped", { fields: validation.stripped });

  const durable = Boolean(decodeStoreKey(env.LEAD_STORE_KEY));
  const shared = options.store ?? openJsonStore("lead-intake", { strong: true });
  const recordKey = durable ? env.LEAD_STORE_KEY! : randomBytes(32).toString("base64");
  const recordStore = durable ? shared : privateJsonStore();
  const recordEnv = durable ? env : { ...env, LEAD_STORE_KEY: recordKey };
  const crm = options.crm ?? createLiveCrm();
  const mailer = options.mailer ?? createMailer(decision, env);
  const deps: ProcessDeps = { store: recordStore, crm, mailer, env: recordEnv, now, decision };

  if (validation.spam) {
    const stamp = new Date(now()).toISOString();
    await shared.setJSON(`spam/${validation.spam}/${stamp}`, { at: stamp, reason: validation.spam }).catch(() => undefined);
    return { status: 200, body: { ok: true } };
  }

  const lead = validation.lead;
  const subKey = submissionKey({
    clientSubmissionId: lead.client_submission_id,
    email: lead.email,
    formVariant: lead.form_variant,
    message: lead.message,
    receivedAtMs: now(),
  });

  if (durable) {
    const existing = await shared.get(`sub/${subKey}`).catch(() => null) as SubmissionRecord | null;
    if (existing) {
      const due = (existing.state === "queued" || existing.state === "retry_scheduled") && existing.nextAttemptAt <= now();
      if (due) await runPipeline(subKey, deps);
      return received();
    }
  }

  const limit = await enforceRateLimit({
    store: shared,
    now: now(),
    salt: env.LEAD_HASH_SALT,
    ip: clientIp(headers),
    email: lead.email,
    limits: {
      ip: numberEnv(env, "LEAD_RL_IP", 5),
      email: numberEnv(env, "LEAD_RL_EMAIL", 3),
      global: numberEnv(env, "LEAD_RL_GLOBAL", 60),
    },
  });
  if (limit.status === "limited") {
    return { status: 429, body: { ok: false, error: "Please wait a moment and try again." }, retryAfter: limit.retryAfter };
  }

  const at = now();
  const payload = encryptJson({
    lead,
    ipHash: env.LEAD_HASH_SALT && env.LEAD_HASH_SALT.length >= 32 && clientIp(headers) ? hmacHex(env.LEAD_HASH_SALT, clientIp(headers) || "") : undefined,
    consent: { at: new Date(at).toISOString(), version: env.LEAD_CONSENT_VERSION || "2026-10-v1" },
    receivedAt: at,
  }, recordKey);
  const record: SubmissionRecord = {
    v: 1,
    subKey,
    state: "queued",
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: new Date(at).toISOString(),
    updatedAt: new Date(at).toISOString(),
    steps: emptySteps(),
    payload,
  };

  if (durable) {
    try {
      const wrote = await shared.setJSON(`sub/${subKey}`, record, { onlyIfNew: true });
      if (!wrote.modified) return received();
      await shared.setJSON(`queue/${subKey}`, { at: record.createdAt });
    } catch {
      const fallback = privateJsonStore();
      await fallback.setJSON(`sub/${subKey}`, record);
      await fallback.setJSON(`queue/${subKey}`, { at: record.createdAt });
      const synced = await runPipeline(subKey, { ...deps, store: fallback });
      return synced?.steps.contact.status === "done" ? received() : failed();
    }
  } else {
    await recordStore.setJSON(`sub/${subKey}`, record);
    await recordStore.setJSON(`queue/${subKey}`, { at: record.createdAt });
  }

  const processed = await runPipeline(subKey, deps);
  if (!durable && processed?.steps.contact.status !== "done") return failed();
  if (durable && decision.mode !== "mock") {
    try {
      after(() => runDue(deps, { limit: 2, budgetMs: 5_000 }));
    } catch {
      // The scheduled function is the durable retry path when after() is unavailable.
    }
  }
  return received();
}

async function runPipeline(subKey: string, deps: ProcessDeps): Promise<SubmissionRecord | null> {
  try {
    return await processSubmission(subKey, deps);
  } catch (error) {
    if (error instanceof LiveTestBlockedError) throw error;
    logLead("error", "lead_pipeline_error", { submission_id: subKey.slice(0, 12), errorClass: error instanceof Error ? error.name : "unknown" });
    return await deps.store.get(`sub/${subKey}`) as SubmissionRecord | null;
  }
}
