/**
 * Phase 2B lead automation extras (owner, follow-up task, company, note, notification).
 *
 * Design rules:
 * - Everything here runs AFTER the contact upsert has succeeded.
 * - Every step is isolated in try/catch; failures are logged and never change the
 *   HTTP response the visitor sees.
 * - Nothing runs unless LEAD_AUTOMATION_ENABLED === 'true' (deploy is a no-op until enabled).
 * - No secrets are ever logged.
 */

const HUBSPOT_BASE = 'https://api.hubapi.com';
const STEP_TIMEOUT_MS = 4_000;

export const TASK_SUBJECT_PREFIX = 'SSG Web Inquiry:';

// HubSpot-defined association type IDs (v4 associations docs).
const ASSOC_TASK_TO_CONTACT = 204;
const ASSOC_NOTE_TO_CONTACT = 202;
const ASSOC_COMPANY_TO_CONTACT = 280;

export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
  'pm.me', 'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru', 'comcast.net',
  'att.net', 'sbcglobal.net', 'verizon.net', 'bellsouth.net', 'charter.net', 'cox.net', 'frontier.com',
  'earthlink.net', 'fastmail.com', 'hey.com', 'tutanota.com', 'qq.com', '163.com',
]);

// Hosted-site platforms: a subdomain on these is not the business's own domain.
const SHARED_HOST_SUFFIXES = [
  'godaddysites.com', 'wixsite.com', 'squarespace.com', 'weebly.com', 'wordpress.com', 'blogspot.com',
  'facebook.com', 'linkedin.com', 'instagram.com', 'google.com', 'business.site', 'netlify.app',
  'vercel.app', 'carrd.co', 'square.site', 'yelp.com', 'angi.com', 'homeadvisor.com',
];

export type LeadPayload = Record<string, unknown> & {
  email?: string; first_name?: string; last_name?: string; phone?: string; company?: string;
  website?: string; source?: string; form_variant?: string; message?: string; timeline?: string;
};

export type AutomationContext = {
  token: string;
  contactId: string;
  action: 'created' | 'updated';
  existingOwnerId?: string;
  email: string;
  body: LeadPayload;
  summary: string;
};

export type AutomationResult = Record<string, string>;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/* ---------------------------------------------------------------- timeline */

const TIMELINE_LABELS: Record<string, string> = {
  not_sure: 'Not sure yet',
  asap: 'As soon as practical',
  '1_3_months': 'Within 1–3 months',
  '3_plus_months': 'More than 3 months away',
};

/** Maps the /contact "Ideal timing" value to a readable label. Accepts legacy label values too. */
export function timelineLabel(raw: unknown): string {
  const value = text(raw);
  if (!value) return 'Not provided';
  if (TIMELINE_LABELS[value]) return TIMELINE_LABELS[value];
  const legacy = Object.values(TIMELINE_LABELS).find((label) => label === value || label.replace('–', '-') === value);
  return legacy || value.slice(0, 100);
}

/* ---------------------------------------------------------------- spam */

/** Conservative spam heuristics. Honeypot (faxNumber) is rejected earlier in the route. */
export function spamReason(body: LeadPayload): string | null {
  if (text(body.faxNumber)) return 'honeypot';
  const message = text(body.message);
  const name = `${text(body.first_name)} ${text(body.last_name)}`;
  const links = (message.match(/https?:\/\/|www\./gi) || []).length;
  if (links > 3) return 'too_many_links';
  if (/https?:\/\/|www\.|<a\s/i.test(name)) return 'link_in_name';
  if (/<a\s+href=|\[url=/i.test(message)) return 'html_or_bbcode_link';
  if (message && /^[^a-z]*$/i.test(message) && message.length > 20) return 'no_latin_letters';
  return null;
}

/* ---------------------------------------------------------------- domains */

function hostnameOf(raw: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isFreeMail(domain: string) {
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase());
}

function excludedDomains(): Set<string> {
  return new Set(
    text(process.env.LEAD_EXCLUDED_COMPANY_DOMAINS).toLowerCase().split(',').map((d) => d.trim()).filter(Boolean),
  );
}

/** Business domain from website first, then email; null for free-mail / shared hosts / excluded domains. */
export function businessDomain(website: unknown, email: string): string | null {
  const excluded = excludedDomains();
  const candidates = [hostnameOf(text(website)), email.split('@')[1]?.toLowerCase() || ''];
  for (const domain of candidates) {
    if (!domain || !domain.includes('.')) continue;
    if (isFreeMail(domain) || excluded.has(domain)) continue;
    if (SHARED_HOST_SUFFIXES.some((s) => domain === s || domain.endsWith(`.${s}`))) continue;
    return domain;
  }
  return null;
}

/* ---------------------------------------------------------------- HubSpot */

async function hs(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`HubSpot ${init.method || 'GET'} ${path.split('?')[0]} -> ${response.status}: ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

function ownerId() {
  const id = text(process.env.HUBSPOT_DEFAULT_OWNER_ID);
  return /^\d+$/.test(id) ? id : '';
}

/** 1. Assign owner only when the contact has none (never overrides a manual reassignment). */
export async function assignOwner(ctx: AutomationContext): Promise<string> {
  const owner = ownerId();
  if (!owner) return 'skipped:no_owner_env';
  if (ctx.existingOwnerId) return 'skipped:already_owned';
  await hs(ctx.token, `/crm/v3/objects/contacts/${ctx.contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { hubspot_owner_id: owner } }),
  });
  return 'assigned';
}

function dedupeWindowDays() {
  const n = Number(process.env.LEAD_TASK_DEDUPE_DAYS || 7);
  return Number.isFinite(n) && n > 0 && n <= 90 ? n : 7;
}

/** Returns an existing open follow-up task id for this contact inside the dedupe window, if any. */
export async function findOpenFollowUpTask(ctx: AutomationContext): Promise<string | null> {
  const since = Date.now() - dedupeWindowDays() * 24 * 60 * 60 * 1000;
  const data = await hs(ctx.token, '/crm/v3/objects/tasks/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{
        filters: [
          { propertyName: 'associations.contact', operator: 'EQ', value: ctx.contactId },
          { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' },
          { propertyName: 'hs_createdate', operator: 'GTE', value: String(since) },
        ],
      }],
      properties: ['hs_task_subject', 'hs_task_status'],
      limit: 20,
    }),
  });
  const match = (data?.results || []).find((t: { properties?: { hs_task_subject?: string } }) =>
    (t.properties?.hs_task_subject || '').startsWith(TASK_SUBJECT_PREFIX));
  return match?.id ?? null;
}

function variantLabel(body: LeadPayload) {
  const variant = text(body.form_variant);
  if (variant === 'website_review') return 'Free website review';
  if (variant === 'audit') return 'Audit';
  return 'Website quote request';
}

function displayName(body: LeadPayload, email: string) {
  return [text(body.first_name), text(body.last_name)].filter(Boolean).join(' ') || email;
}

/** 2. Create exactly one open follow-up task per contact per dedupe window. */
export async function ensureFollowUpTask(ctx: AutomationContext): Promise<{ status: string; taskId?: string }> {
  const existing = await findOpenFollowUpTask(ctx);
  if (existing) return { status: 'skipped:duplicate', taskId: existing };
  const owner = ownerId();
  const dueHours = Number(process.env.LEAD_TASK_DUE_HOURS || 24);
  const company = text(ctx.body.company);
  const properties: Record<string, string> = {
    hs_task_subject: `${TASK_SUBJECT_PREFIX} ${displayName(ctx.body, ctx.email)}${company ? ` (${company.slice(0, 80)})` : ''} — ${variantLabel(ctx.body)}`,
    hs_task_body: ctx.summary.slice(0, 5000),
    hs_task_status: 'NOT_STARTED',
    hs_task_priority: 'HIGH',
    hs_task_type: 'EMAIL',
    hs_timestamp: new Date(Date.now() + (Number.isFinite(dueHours) ? dueHours : 24) * 3_600_000).toISOString(),
  };
  if (owner) properties.hubspot_owner_id = owner;
  const created = await hs(ctx.token, '/crm/v3/objects/tasks', {
    method: 'POST',
    body: JSON.stringify({
      properties,
      associations: [{ to: { id: ctx.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC_TASK_TO_CONTACT }] }],
    }),
  });
  return { status: 'created', taskId: created?.id };
}

/** Keeps a per-submission history (the contact "message" property is overwritten each time). */
export async function addSubmissionNote(ctx: AutomationContext): Promise<string> {
  await hs(ctx.token, '/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: escapeHtml(ctx.summary.slice(0, 10000)).replace(/\n/g, '<br>') },
      associations: [{ to: { id: ctx.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC_NOTE_TO_CONTACT }] }],
    }),
  });
  return 'created';
}

/** 4. Associate a company by business domain; create one only with business name + non-free domain. */
export async function associateCompany(ctx: AutomationContext): Promise<string> {
  const existing = await hs(ctx.token, `/crm/v4/objects/contact/${ctx.contactId}/associations/company?limit=1`);
  if (existing?.results?.length) return 'skipped:already_associated';

  const domain = businessDomain(ctx.body.website, ctx.email);
  if (!domain) return 'skipped:no_business_domain';

  const search = await hs(ctx.token, '/crm/v3/objects/companies/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
      properties: ['domain', 'name'],
      sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
      limit: 1,
    }),
  });
  const companyId: string | undefined = search?.results?.[0]?.id;
  if (companyId) {
    await hs(ctx.token, `/crm/v4/objects/contact/${ctx.contactId}/associations/default/company/${companyId}`, { method: 'PUT' });
    return `associated_existing:${companyId}`;
  }

  const name = text(ctx.body.company);
  if (!name) return 'skipped:no_company_name';
  const properties: Record<string, string> = { name: name.slice(0, 160), domain };
  const website = text(ctx.body.website);
  if (website && hostnameOf(website) === domain) properties.website = website;
  const owner = ownerId();
  if (owner) properties.hubspot_owner_id = owner;
  const created = await hs(ctx.token, '/crm/v3/objects/companies', {
    method: 'POST',
    body: JSON.stringify({
      properties,
      associations: [{ to: { id: ctx.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC_COMPANY_TO_CONTACT }] }],
    }),
  });
  return `created:${created?.id}`;
}

/* ---------------------------------------------------------------- notification */

export function recordUrl(contactId: string) {
  const portal = text(process.env.HUBSPOT_PORTAL_ID) || '246622244';
  const base = text(process.env.HUBSPOT_APP_BASE_URL) || 'https://app.hubspot.com';
  return `${base}/contacts/${portal}/record/0-1/${contactId}`;
}

/**
 * 3. Optional email notification via Resend (free tier). Only sends when a NEW task was created,
 * so resubmissions/duplicates do not generate extra email. Primary notification is HubSpot's
 * built-in "Task assigned to you" email, which needs no code.
 */
export async function sendNotification(ctx: AutomationContext, taskStatus: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = text(process.env.NOTIFY_EMAIL_TO);
  const from = text(process.env.NOTIFY_EMAIL_FROM);
  if (!apiKey || !to || !from) return 'skipped:not_configured';
  if (taskStatus !== 'created') return 'skipped:no_new_task';
  const name = displayName(ctx.body, ctx.email);
  const lines = [
    `New ${variantLabel(ctx.body).toLowerCase()} (${ctx.action} contact)`,
    '',
    `Name: ${name}`,
    `Email: ${ctx.email}`,
    `Phone: ${text(ctx.body.phone) || '—'}`,
    `Company: ${text(ctx.body.company) || '—'}`,
    `Website: ${text(ctx.body.website) || '—'}`,
    '',
    ctx.summary,
    '',
    `HubSpot record: ${recordUrl(ctx.contactId)}`,
  ];
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: to.split(',').map((s) => s.trim()).filter(Boolean),
      subject: `[SSG lead] ${name}${text(ctx.body.company) ? ` — ${text(ctx.body.company).slice(0, 80)}` : ''}`,
      text: lines.join('\n'),
    }),
    signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Resend send failed -> ${response.status}`);
  return 'sent';
}

/* ---------------------------------------------------------------- orchestrator */

async function safe<T>(step: string, contactId: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(JSON.stringify({
      event: 'lead_automation_step_failed', step, contactId,
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return fallback;
  }
}

export function automationEnabled() {
  return process.env.LEAD_AUTOMATION_ENABLED === 'true';
}

/** Runs all extras; never throws. */
export async function runLeadAutomation(ctx: AutomationContext): Promise<AutomationResult> {
  const result: AutomationResult = {};
  try {
    const spam = spamReason(ctx.body);
    if (spam) {
      console.warn(JSON.stringify({ event: 'lead_automation_skipped_spam', reason: spam, contactId: ctx.contactId }));
      return { skipped: `spam:${spam}` };
    }
    const id = ctx.contactId;
    const [owner, task, company] = await Promise.all([
      safe('owner', id, () => assignOwner(ctx), 'error'),
      safe('task', id, () => ensureFollowUpTask(ctx), { status: 'error' } as { status: string; taskId?: string }),
      safe('company', id, () => associateCompany(ctx), 'error'),
    ]);
    result.owner = owner;
    result.task = task.taskId ? `${task.status}:${task.taskId}` : task.status;
    result.company = company;
    const [note, notify] = await Promise.all([
      safe('note', id, () => addSubmissionNote(ctx), 'error'),
      safe('notify', id, () => sendNotification(ctx, task.status), 'error'),
    ]);
    result.note = note;
    result.notify = notify;
    console.info(JSON.stringify({ event: 'lead_automation_done', contactId: id, ...result }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'lead_automation_failed', message: error instanceof Error ? error.message : 'unknown' }));
  }
  return result;
}

/**
 * Bounded wrapper used by the API route: the visitor's response waits at most
 * LEAD_AUTOMATION_BUDGET_MS (default 5000 ms) for extras, so the function stays well
 * inside Netlify's synchronous function timeout. Never throws.
 */
export async function runLeadAutomationWithBudget(ctx: AutomationContext): Promise<AutomationResult> {
  const budget = Number(process.env.LEAD_AUTOMATION_BUDGET_MS || 5_000);
  const ms = Number.isFinite(budget) && budget > 0 ? Math.min(budget, 8_000) : 5_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AutomationResult>((resolve) => {
    timer = setTimeout(() => {
      console.warn(JSON.stringify({ event: 'lead_automation_budget_exceeded', contactId: ctx.contactId, ms }));
      resolve({ timedOut: 'true' });
    }, ms);
  });
  try {
    return await Promise.race([runLeadAutomation(ctx), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
