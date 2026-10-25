import type { JsonStore } from "../blob-store";
import { businessDomain, recordUrl, spamReason } from "../hubspot/lead-automation";
import type { Crm } from "./crm";
import { errorClass } from "./crm";
import { decryptJson } from "./crypto";
import { escapeHtml, hubspotMessage } from "./message";
import { logLead } from "./log";
import type { Mailer } from "./notify";
import { resolveOwner } from "./owners";
import { createNote, ensureInquiryTask, TASK_SUBJECT_PREFIX } from "./tasks";
import { emptySteps, type LeadInput, type StepName, type StepState, type StepStatus, type StoredLead, type SubmissionRecord } from "./types";
import { buildWebhookBody, signWebhook, webhookGate } from "./webhook";
import { LiveTestBlockedError, outboundFetch } from "../gateway";
import type { ModeDecision } from "../runtime-mode";

const BACKOFF_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 12 * 60 * 60_000];

export type ProcessDeps = {
  store: JsonStore;
  crm: Crm;
  mailer: Mailer;
  env: NodeJS.ProcessEnv;
  now: () => number;
  decision: ModeDecision;
  /** Runs after the visitor response. Cron omits this and delivers inline. */
  schedule?: (work: () => Promise<unknown>) => void;
};

function numberEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = Number(env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function dueMs(env: NodeJS.ProcessEnv, now: number): number {
  return now + numberEnv(env, "LEAD_TASK_DUE_HOURS", 24) * 3_600_000;
}

function routedOwner(env: NodeJS.ProcessEnv, projectType: string): string {
  if (!env.OWNER_ROUTING_JSON) return "";
  try {
    const table = JSON.parse(env.OWNER_ROUTING_JSON) as Record<string, string>;
    return table[projectType] || "";
  } catch {
    return "";
  }
}

function defaultOwner(env: NodeJS.ProcessEnv, decision: ModeDecision): string {
  if (decision.mode === "live-test") return env.HUBSPOT_TEST_DEFAULT_OWNER_ID || "";
  return env.HUBSPOT_DEFAULT_OWNER_ID || "";
}

async function save(deps: ProcessDeps, subKey: string, mutate: (record: SubmissionRecord) => SubmissionRecord): Promise<SubmissionRecord> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await deps.store.getWithMetadata(`sub/${subKey}`);
    if (!current) throw new Error("missing_submission");
    const next = mutate(current.data as SubmissionRecord);
    next.updatedAt = new Date(deps.now()).toISOString();
    const written = await deps.store.setJSON(`sub/${subKey}`, next, { onlyIfMatch: current.etag });
    if (written.modified) return next;
  }
  throw new Error("envelope_conflict");
}

function finish(record: SubmissionRecord, name: StepName, status: StepStatus, extra?: Partial<StepState>): SubmissionRecord {
  record.steps[name] = { status, at: record.updatedAt, ...extra };
  return record;
}

export async function processSubmission(subKey: string, deps: ProcessDeps): Promise<SubmissionRecord> {
  const key = deps.env.LEAD_STORE_KEY || "";
  let record = await deps.store.get(`sub/${subKey}`) as SubmissionRecord | null;
  if (!record) throw new Error("missing_submission");
  if (record.state === "completed" || record.state === "dead_letter") return record;
  if (!record.payload?.iv || !record.payload?.tag || !record.payload?.data) throw new Error("lead_poison_record");
  let stored: StoredLead;
  try {
    stored = decryptJson<StoredLead>(record.payload, key);
  } catch {
    throw new Error("lead_poison_record");
  }
  const lead = stored.lead;
  const automation = deps.env.LEAD_AUTOMATION_ENABLED === "true";
  const links = spamReason({ ...lead, faxNumber: "" });
  record = await save(deps, subKey, (current) => ({ ...current, state: "processing" }));

  if (record.steps.contact.status !== "done") {
    const captured = await captureContact(deps, lead, stored);
    record = await save(deps, subKey, (current) => {
      current.steps.contact = { status: captured.status, at: new Date(deps.now()).toISOString(), ref: captured.contactId, err: captured.err };
      if (captured.contactId) current.contactId = captured.contactId;
      if (captured.errorClass) current.lastErrorClass = captured.errorClass;
      return current;
    });
  }

  if (!automation || links) {
    if (!automation) {
      logLead("warn", "lead_automation_disabled", { submission_id: subKey.slice(0, 12), steps: "task,notify" });
    }
    if (links) {
      logLead("warn", "lead_spam_skipped", { submission_id: subKey.slice(0, 12), reason: links, steps: "task,notify" });
    }
    record = await save(deps, subKey, (current) => {
      for (const step of ["owner", "company", "note", "task", "notify"] as StepName[]) {
        if (current.steps[step].status === "pending") current.steps[step] = { status: "skipped", err: links ? `spam:${links}` : "automation_disabled" };
      }
      return current;
    });
  } else {
    record = await runAutomation(deps, record, lead, stored);
  }

  const gate = webhookGate(deps.env);
  const deferWebhook = webhookOpen(record) && deps.decision.mode === "live" && gate.enabled && typeof deps.schedule === "function";
  if (webhookOpen(record) && !deferWebhook) {
    record = await applyWebhook(deps, record, lead, subKey, stored.receivedAt);
  }

  const settled = await settle(deps, record, subKey, { ignoreWebhook: deferWebhook });
  if (deferWebhook && deps.schedule) {
    const follow: ProcessDeps = { ...deps, schedule: undefined };
    deps.schedule(() => finishWebhook(subKey, follow));
  }
  return settled;
}

function webhookOpen(record: SubmissionRecord): boolean {
  return ["pending", "failed", "unknown", "deferred"].includes(record.steps.webhook.status);
}

async function applyWebhook(deps: ProcessDeps, record: SubmissionRecord, lead: LeadInput, subKey: string, receivedAt: number): Promise<SubmissionRecord> {
  const webhook = await deliverWebhook(deps, lead, record.contactId, subKey, receivedAt);
  return save(deps, subKey, (current) => finish(current, "webhook", webhook.status, { err: webhook.err, ref: webhook.ref }));
}

/** Background delivery. The visitor response has already been sent. */
export async function finishWebhook(subKey: string, deps: ProcessDeps): Promise<SubmissionRecord | null> {
  const key = deps.env.LEAD_STORE_KEY || "";
  const current = await deps.store.get(`sub/${subKey}`) as SubmissionRecord | null;
  if (!current || !webhookOpen(current)) return current;
  const stored = decryptJson<StoredLead>(current.payload, key);
  const updated = await applyWebhook(deps, current, stored.lead, subKey, stored.receivedAt);
  return settle(deps, updated, subKey, { webhookOnly: true });
}

async function runAutomation(deps: ProcessDeps, record: SubmissionRecord, lead: LeadInput, stored: StoredLead): Promise<SubmissionRecord> {
  const contactId = record.contactId;
  if (!contactId) return record;
  const version = deps.env.LEAD_CONSENT_VERSION || "2026-10-v1";
  const summary = hubspotMessage(lead, new Date(stored.receivedAt).toISOString(), version);
  let ownerId = "";
  if (record.steps.owner.status !== "done" && record.steps.owner.status !== "skipped") {
    const existing = await readOwner(deps.crm, contactId);
    const resolved = await resolveOwner({
      crm: deps.crm,
      store: deps.store,
      candidates: [existing || "", routedOwner(deps.env, lead.project_type), defaultOwner(deps.env, deps.decision)].filter(Boolean),
      now: deps.now(),
    });
    ownerId = resolved.ownerId || "";
    const status: StepStatus = resolved.status === "ready" ? "done" : resolved.status === "unknown" ? "unknown" : "blocked_needs_owner";
    const previouslyBlocked = record.steps.owner.status === "blocked_needs_owner";
    if (resolved.status === "ready" && ownerId && !existing) {
      await deps.crm.request("PATCH", `/crm/v3/objects/contacts/${contactId}`, { properties: { hubspot_owner_id: ownerId } }, "safe");
    }
    record = await save(deps, record.subKey, (current) => finish(current, "owner", status, { ref: ownerId || undefined, err: resolved.status === "blocked" ? "needs_owner" : undefined }));
    if (resolved.status === "blocked" && !previouslyBlocked) await alert(deps, record, "needs_owner");
  } else {
    ownerId = record.steps.owner.ref || defaultOwner(deps.env, deps.decision);
  }

  if (record.steps.company.status === "pending" || record.steps.company.status === "failed" || record.steps.company.status === "unknown") {
    const company = await associateCompany(deps, contactId, lead, ownerId);
    record = await save(deps, record.subKey, (current) => finish(current, "company", company.status, { ref: company.ref, err: company.err }));
  }

  if (record.steps.note.status !== "done" && record.steps.note.status !== "skipped") {
    const note = await createNote(deps.crm, contactId, record.subKey, escapeHtml(summary).replace(/\n/g, "<br>"));
    record = await save(deps, record.subKey, (current) => finish(current, "note", note === "done" ? "done" : "unknown"));
  }

  let taskOutcome = record.steps.task.ref?.split(":")[0] || "";
  if (record.steps.task.status !== "done" && record.steps.task.status !== "skipped") {
    if (!ownerId) {
      record = await save(deps, record.subKey, (current) => finish(current, "task", "blocked_needs_owner", { err: "needs_owner" }));
    } else {
      const task = await ensureInquiryTask({
        crm: deps.crm,
        store: deps.store,
        contactId,
        subKey: record.subKey,
        ownerId,
        subject: `${TASK_SUBJECT_PREFIX} ${lead.company || lead.first_name}`,
        body: summary.slice(0, 5000),
        dueMs: dueMs(deps.env, deps.now()),
        lockRetryMs: numberEnv(deps.env, "LEAD_LOCK_RETRY_MS", 2_000),
        now: deps.now(),
      });
      taskOutcome = task.outcome;
      const status: StepStatus = task.outcome === "created" || task.outcome === "appended" ? "done" : task.outcome === "blocked" ? "blocked_needs_owner" : task.outcome === "deferred" ? "deferred" : "unknown";
      record = await save(deps, record.subKey, (current) => {
        current.taskId = task.taskId || current.taskId;
        return finish(current, "task", status, { ref: task.taskId ? `${task.outcome}:${task.taskId}` : task.outcome, err: status === "blocked_needs_owner" ? "needs_owner" : undefined });
      });
    }
  }

  if (record.steps.notify.status !== "done" && record.steps.notify.status !== "skipped") {
    const sent = await sendInquiryMail(deps, lead, record, taskOutcome, summary);
    record = await save(deps, record.subKey, (current) => {
      if (sent.id) current.notifyMessageId = sent.id;
      return finish(current, "notify", sent.status, { ref: sent.id, err: sent.err });
    });
  }
  return record;
}

async function readOwner(crm: Crm, contactId: string): Promise<string> {
  const result = await crm.request("GET", `/crm/v3/objects/contacts/${contactId}?properties=hubspot_owner_id`, undefined, "safe");
  return (result.data as { properties?: { hubspot_owner_id?: string } })?.properties?.hubspot_owner_id || "";
}

async function captureContact(deps: ProcessDeps, lead: LeadInput, stored: StoredLead): Promise<{ status: StepStatus; contactId?: string; err?: string; errorClass?: SubmissionRecord["lastErrorClass"] }> {
  const version = deps.env.LEAD_CONSENT_VERSION || "2026-10-v1";
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.first_name,
    message: hubspotMessage(lead, new Date(stored.receivedAt).toISOString(), version),
  };
  if (lead.last_name) properties.lastname = lead.last_name;
  if (lead.phone) properties.phone = lead.phone;
  if (lead.company) properties.company = lead.company;
  if (lead.website) properties.website = lead.website;
  const found = await deps.crm.request("GET", `/crm/v3/objects/contacts/${encodeURIComponent(lead.email)}?idProperty=email&properties=hubspot_owner_id`, undefined, "safe");
  if (found.networkError || found.status >= 500 || found.status === 429) return { status: "failed", err: "contact_read", errorClass: "retryable" };
  if (found.status === 200) {
    const id = (found.data as { id?: string }).id || "";
    const patched = await deps.crm.request("PATCH", `/crm/v3/objects/contacts/${id}`, { properties }, "safe");
    if (patched.status < 400) return { status: "done", contactId: id };
    return { status: "failed", err: "contact_update", errorClass: errorClass(patched) };
  }
  const created = await deps.crm.request("POST", "/crm/v3/objects/contacts", { properties }, "never");
  if (created.networkError || created.status === 0) return { status: "unknown", err: "contact_create", errorClass: "retryable" };
  if (created.status === 409) {
    const match = String((created.data as { message?: string })?.message || "").match(/Existing ID:\s*(\d+)/i);
    if (!match) return { status: "unknown", err: "contact_conflict", errorClass: "retryable" };
    const patched = await deps.crm.request("PATCH", `/crm/v3/objects/contacts/${match[1]}`, { properties }, "safe");
    return patched.status < 400 ? { status: "done", contactId: match[1] } : { status: "failed", err: "contact_update", errorClass: errorClass(patched) };
  }
  if (created.status >= 400) return { status: "failed", err: "contact_create", errorClass: errorClass(created) };
  return { status: "done", contactId: (created.data as { id?: string }).id };
}

async function associateCompany(deps: ProcessDeps, contactId: string, lead: LeadInput, ownerId: string): Promise<{ status: StepStatus; ref?: string; err?: string }> {
  const existing = await deps.crm.request("GET", `/crm/v4/objects/contact/${contactId}/associations/company?limit=1`, undefined, "safe");
  if (existing.networkError || existing.status >= 500) return { status: "failed", err: "company_read" };
  if (((existing.data as { results?: unknown[] })?.results || []).length) return { status: "skipped", ref: "already_associated" };
  const domain = businessDomain(lead.website, lead.email);
  if (!domain) return { status: "skipped", ref: "no_business_domain" };
  const search = await deps.crm.request("POST", "/crm/v3/objects/companies/search", {
    filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
    properties: ["domain", "name"],
    limit: 1,
  }, "safe");
  if (search.networkError || search.status >= 400) return { status: "failed", err: "company_search" };
  const companyId = (search.data as { results?: { id: string }[] })?.results?.[0]?.id;
  if (companyId) {
    const linked = await deps.crm.request("PUT", `/crm/v4/objects/contact/${contactId}/associations/default/company/${companyId}`, undefined, "safe");
    return linked.status < 400 ? { status: "done", ref: companyId } : { status: "failed", err: "company_link" };
  }
  if (!lead.company) return { status: "skipped", ref: "no_company_name" };
  const properties: Record<string, string> = { name: lead.company.slice(0, 160), domain };
  if (ownerId) properties.hubspot_owner_id = ownerId;
  const created = await deps.crm.request("POST", "/crm/v3/objects/companies", {
    properties,
    associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 280 }] }],
  }, "never");
  if (created.networkError || created.status === 0) return { status: "unknown", err: "company_create" };
  if (created.status >= 400) return { status: "failed", err: "company_create" };
  return { status: "done", ref: (created.data as { id?: string }).id };
}

async function sendInquiryMail(deps: ProcessDeps, lead: LeadInput, record: SubmissionRecord, taskOutcome: string, summary: string): Promise<{ status: StepStatus; id?: string; err?: string }> {
  const to = (deps.decision.mode === "live-test" ? deps.env.NOTIFY_EMAIL_TEST_TO : deps.env.NOTIFY_EMAIL_TO) || "";
  const from = (deps.decision.mode === "live-test" ? deps.env.NOTIFY_EMAIL_TEST_FROM || deps.env.NOTIFY_EMAIL_FROM : deps.env.NOTIFY_EMAIL_FROM) || "";
  const recipients = to.split(",").map((item) => item.trim()).filter(Boolean);
  if (!recipients.length || !from) return { status: "skipped", err: "notify_unconfigured" };
  const followUp = taskOutcome === "appended";
  const link = record.contactId ? recordUrl(record.contactId) : "";
  const result = await deps.mailer.send({
    to: recipients,
    from,
    subject: `${followUp ? "Follow-up inquiry" : "New web inquiry"}: ${lead.company || lead.first_name}`,
    idempotencyKey: `notify:${record.subKey}`,
    text: [
      lead.first_name,
      lead.company,
      lead.form_variant,
      lead.project_type,
      lead.timeline,
      lead.message.slice(0, 300),
      link,
      record.taskId ? `task:${record.taskId}` : "",
    ].filter(Boolean).join("\n"),
  });
  if (result.skipped) return { status: "skipped", err: result.skipped };
  if (result.status >= 400) return { status: "failed", err: "notify_failed", id: result.id };
  return { status: "done", id: result.id };
}

async function deliverWebhook(deps: ProcessDeps, lead: LeadInput, contactId: string | undefined, subKey: string, receivedAt: number): Promise<{ status: StepStatus; err?: string; ref?: string }> {
  if (deps.decision.mode !== "live") return { status: "skipped", err: "webhook_disabled" };
  const gate = webhookGate(deps.env);
  logLead(gate.enabled ? "info" : "warn", "webhook_gate", {
    reason: gate.reason,
    url: Boolean(deps.env.LEAD_WEBHOOK_URL),
    authorized: deps.env.LEAD_WEBHOOK_AUTHORIZED === "true",
    secret: Boolean(deps.env.LEAD_WEBHOOK_SECRET),
  });
  if (!gate.enabled) return { status: "skipped", err: gate.reason };
  const raw = buildWebhookBody({
    subKey,
    occurredAt: new Date(receivedAt).toISOString(),
    lead,
    recordUrl: contactId ? recordUrl(contactId) : undefined,
    includeContact: deps.env.LEAD_WEBHOOK_INCLUDE_CONTACT === "true",
  });
  const timestamp = String(Math.floor(deps.now() / 1000));
  const response = await outboundFetch({
    channel: "webhook",
    policy: "lead",
    url: deps.env.LEAD_WEBHOOK_URL,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-SSG-Event-Id": subKey,
      "X-SSG-Timestamp": timestamp,
      "X-SSG-Signature": signWebhook(deps.env.LEAD_WEBHOOK_SECRET || "", timestamp, raw),
    },
    body: raw,
    timeoutMs: 3_000,
  });
  if (response.headers.get("X-SSG-Outbound") === "mock") return { status: "skipped", err: "webhook_disabled" };
  if (response.ok) return { status: "done", ref: subKey };
  if (response.status >= 400 && response.status !== 408 && response.status !== 429) return { status: "failed", err: "webhook_permanent" };
  return { status: "failed", err: "webhook_retry" };
}

async function alert(deps: ProcessDeps, record: SubmissionRecord, reason: string) {
  const liveTest = deps.decision.mode === "live-test";
  const to = ((liveTest ? deps.env.NOTIFY_EMAIL_TEST_TO : deps.env.NOTIFY_EMAIL_TO) || "").split(",").map((item) => item.trim()).filter(Boolean);
  const from = (liveTest ? deps.env.NOTIFY_EMAIL_TEST_FROM || deps.env.NOTIFY_EMAIL_FROM : deps.env.NOTIFY_EMAIL_FROM) || "";
  if (!to.length || !from) return;
  await deps.mailer.send({
    to,
    from,
    subject: "[SSG intake] Lead needs attention",
    idempotencyKey: `alert:${record.subKey}:${reason}`,
    text: [`submission:${record.subKey.slice(0, 12)}`, `reason:${reason}`, record.contactId ? recordUrl(record.contactId) : ""].filter(Boolean).join("\n"),
  });
  logLead("error", "lead_dead_letter", { submission_id: record.subKey.slice(0, 12), reason });
}

function stepWaiting(step: StepState): boolean {
  return ["pending", "unknown", "deferred", "failed", "blocked_needs_owner"].includes(step.status);
}

async function settle(deps: ProcessDeps, record: SubmissionRecord, subKey: string, options?: { ignoreWebhook?: boolean; webhookOnly?: boolean }): Promise<SubmissionRecord> {
  const waiting = (Object.entries(record.steps) as [StepName, StepState][]).some(([name, step]) => {
    if (options?.ignoreWebhook && name === "webhook") return false;
    return stepWaiting(step);
  });
  const webhookHeld = Boolean(options?.ignoreWebhook && stepWaiting(record.steps.webhook));
  if (!waiting) {
    if (webhookHeld) {
      await deps.store.setJSON(`queue/${subKey}`, { at: record.createdAt });
      return save(deps, subKey, (current) => ({ ...current, state: "retry_scheduled", nextAttemptAt: deps.now() + 30_000 }));
    }
    record = await save(deps, subKey, (current) => ({ ...current, state: "completed" }));
    await deps.store.delete(`queue/${subKey}`);
    return record;
  }
  const webhookPermanent = record.steps.webhook.err === "webhook_permanent";
  if (options?.webhookOnly && !webhookPermanent && record.state === "retry_scheduled" && record.nextAttemptAt > deps.now()) {
    return record;
  }
  const permanent = record.lastErrorClass === "permanent" || webhookPermanent;
  const attempts = record.attempts + 1;
  const max = numberEnv(deps.env, "LEAD_MAX_ATTEMPTS", 6);
  if (permanent || attempts >= max) {
    record = await save(deps, subKey, (current) => ({ ...current, state: "dead_letter", attempts }));
    await deps.store.delete(`queue/${subKey}`);
    await deps.store.setJSON(`dlq/${subKey}`, { reason: permanent ? "permanent" : "attempts", at: new Date(deps.now()).toISOString(), contactId: record.contactId });
    await alert(deps, record, permanent ? "permanent" : "attempts");
    return record;
  }
  const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
  return save(deps, subKey, (current) => ({ ...current, state: "retry_scheduled", attempts, nextAttemptAt: deps.now() + delay, lastErrorClass: "retryable" }));
}

function isPoison(error: unknown): boolean {
  return error instanceof Error && (error.message === "lead_poison_record" || error.message === "missing_submission" || error.message === "store_key_invalid");
}

/** Dead-letter one bad record. Never throws, so the rest of the queue still runs. */
async function quarantine(deps: ProcessDeps, subKey: string, code: string) {
  logLead("error", code, { submission_id: subKey.slice(0, 12), code });
  const at = new Date(deps.now()).toISOString();
  await deps.store.setJSON(`dlq/${subKey}`, { reason: "poison", at, code }).catch(() => undefined);
  await deps.store.delete(`queue/${subKey}`).catch(() => undefined);
  try {
    const record = await save(deps, subKey, (current) => ({ ...current, state: "dead_letter" }));
    await alert(deps, record, "poison");
  } catch {
    logLead("error", "lead_dead_letter", { submission_id: subKey.slice(0, 12), code: "lead_poison_record" });
  }
}

async function bumpFailure(deps: ProcessDeps, subKey: string): Promise<void> {
  try {
    const max = numberEnv(deps.env, "LEAD_MAX_ATTEMPTS", 6);
    let dead = false;
    const record = await save(deps, subKey, (current) => {
      const attempts = current.attempts + 1;
      if (attempts >= max) {
        dead = true;
        return { ...current, state: "dead_letter", attempts };
      }
      const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      return { ...current, state: "retry_scheduled", attempts, nextAttemptAt: deps.now() + delay, lastErrorClass: "retryable" };
    });
    if (!dead) {
      logLead("error", "lead_retry_item_failed", { submission_id: subKey.slice(0, 12), code: "lead_retry_item_failed" });
      return;
    }
    await deps.store.delete(`queue/${subKey}`);
    await deps.store.setJSON(`dlq/${subKey}`, { reason: "attempts", at: new Date(deps.now()).toISOString(), code: "lead_dead_letter" });
    await alert(deps, record, "attempts");
  } catch {
    await quarantine(deps, subKey, "lead_poison_record");
  }
}

export async function runDue(deps: ProcessDeps, options?: { limit?: number; budgetMs?: number }): Promise<number> {
  const started = deps.now();
  const budget = options?.budgetMs ?? 22_000;
  const limit = options?.limit ?? 8;
  let processed = 0;
  try {
    const due = await collectDue(deps);
    for (const item of due) {
      if (processed >= limit || deps.now() - started >= budget) break;
      try {
        if (typeof item.nextAttemptAt !== "number" || !Number.isFinite(item.nextAttemptAt)) {
          await quarantine(deps, item.key, "lead_poison_record");
          continue;
        }
        await processSubmission(item.key, deps);
        processed += 1;
      } catch (error) {
        if (error instanceof LiveTestBlockedError) {
          const code = error.code === "production_mismatch" ? "lead_portal_mismatch" : error.code === "production_portal" ? "lead_live_test_blocked" : "lead_portal_unverified";
          logLead("error", code, { submission_id: item.key.slice(0, 12), code });
          continue;
        }
        if (isPoison(error)) {
          await quarantine(deps, item.key, "lead_poison_record");
          continue;
        }
        await bumpFailure(deps, item.key);
      }
    }
  } finally {
    try {
      await housekeeping(deps);
    } catch {
      logLead("error", "lead_retry_item_failed", { code: "lead_housekeeping_failed" });
    }
  }
  return processed;
}

async function collectDue(deps: ProcessDeps): Promise<{ key: string; at: number; nextAttemptAt: number }[]> {
  const due: { key: string; at: number; nextAttemptAt: number }[] = [];
  const seen = new Set<string>();
  const take = async (subKey: string) => {
    if (!subKey || seen.has(subKey)) return;
    seen.add(subKey);
    try {
      if (await deps.store.get(`dlq/${subKey}`)) return;
      const record = await deps.store.get(`sub/${subKey}`) as SubmissionRecord | null;
      if (!record || typeof record !== "object" || !record.state) {
        await quarantine(deps, subKey, "lead_poison_record");
        return;
      }
      if (record.state === "completed" || record.state === "dead_letter") return;
      const next = record.nextAttemptAt;
      if (typeof next === "number" && Number.isFinite(next) && next > deps.now()) return;
      due.push({ key: subKey, at: record.createdAt ? Date.parse(record.createdAt) || 0 : 0, nextAttemptAt: next });
    } catch {
      await quarantine(deps, subKey, "lead_poison_record");
    }
  };
  try {
    const queued = await deps.store.list({ prefix: "queue/" });
    for (const blob of queued.blobs) await take(blob.key.slice("queue/".length));
  } catch {
    logLead("error", "lead_retry_item_failed", { code: "lead_queue_list_failed" });
  }
  try {
    const subs = await deps.store.list({ prefix: "sub/" });
    for (const blob of subs.blobs) await take(blob.key.slice("sub/".length));
  } catch {
    logLead("error", "lead_retry_item_failed", { code: "lead_queue_list_failed" });
  }
  due.sort((a, b) => a.at - b.at);
  return due;
}

async function housekeeping(deps: ProcessDeps) {
  const now = deps.now();
  const doneDays = numberEnv(deps.env, "LEAD_RETENTION_DONE_DAYS", 14);
  const dlqDays = numberEnv(deps.env, "LEAD_RETENTION_DLQ_DAYS", 30);
  const subs = await deps.store.list({ prefix: "sub/" });
  for (const blob of subs.blobs) {
    try {
      const record = await deps.store.get(blob.key) as SubmissionRecord | null;
      if (!record) continue;
      const age = now - Date.parse(record.updatedAt || record.createdAt);
      if (record.state === "completed" && age > doneDays * 86_400_000) await deps.store.delete(blob.key);
      if (record.state === "dead_letter" && age > dlqDays * 86_400_000) {
        await deps.store.delete(blob.key);
        await deps.store.delete(`dlq/${record.subKey}`);
      }
    } catch {
      logLead("error", "lead_retry_item_failed", { code: "lead_housekeeping_failed" });
    }
  }
  const spam = await deps.store.list({ prefix: "spam/" });
  for (const blob of spam.blobs) {
    const row = await deps.store.get(blob.key) as { at?: string } | null;
    if (row?.at && now - Date.parse(row.at) > 7 * 86_400_000) await deps.store.delete(blob.key);
  }
  const window = Math.floor(now / 600_000);
  const limits = await deps.store.list({ prefix: "rl/" });
  for (const blob of limits.blobs) {
    const id = Number(blob.key.split("/")[2]);
    if (Number.isFinite(id) && id < window - 1) await deps.store.delete(blob.key);
  }
  const locks = await deps.store.list({ prefix: "lock/" });
  for (const blob of locks.blobs) {
    const row = await deps.store.get(blob.key) as { expiresAt?: number } | null;
    if (row?.expiresAt && row.expiresAt <= now) await deps.store.delete(blob.key);
  }
}

export { emptySteps };
