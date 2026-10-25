import { z } from "zod";
import type { LeadInput } from "@/lib/lead/types";

export const PROJECT_TYPES = [
  "A new website",
  "A website redesign",
  "Website + CRM or automation",
  "CRM, automation or local visibility",
  "Help deciding where to start",
] as const;

const TIMELINE_SLUGS = ["", "not_sure", "asap", "1_3_months", "3_plus_months"] as const;

const LEGACY_TIMELINE: Record<string, (typeof TIMELINE_SLUGS)[number]> = {
  "Not sure yet": "not_sure",
  "As soon as practical": "asap",
  "Within 1–3 months": "1_3_months",
  "Within 1-3 months": "1_3_months",
  "More than 3 months away": "3_plus_months",
};

export const ALLOWED_KEYS = [
  "first_name", "last_name", "email", "phone", "company", "website", "project_type", "timeline", "budget",
  "message", "consent", "form_variant", "source", "utm_source", "utm_medium", "utm_campaign", "landing_page",
  "client_submission_id", "form_started_at", "faxNumber",
] as const;

const BODY_LIMIT = 16 * 1024;

function clean(value: unknown, newlines = false): string {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFKC").replace(/\u0000/g, "");
  const stripped = newlines
    ? normalized.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    : normalized.replace(/[\u0000-\u001F\u007F]/g, " ");
  return stripped.trim();
}

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function ownOrigin(value: string, origins: string[]): string {
  const href = normalizeHttpUrl(value);
  if (!href) return "";
  try {
    const host = new URL(href).hostname.toLowerCase();
    return origins.some((origin) => origin.toLowerCase() === host) ? href : "";
  } catch {
    return "";
  }
}

const contactSchema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().max(80),
  email: z.email().max(200),
  phone: z.string().max(40),
  company: z.string().min(1).max(160),
  website: z.string().max(500),
  project_type: z.enum(PROJECT_TYPES),
  timeline: z.enum(TIMELINE_SLUGS),
  budget: z.string().max(100),
  message: z.string().min(10).max(3000),
  consent: z.literal(true),
  form_variant: z.literal("contact"),
  source: z.string().max(80).regex(/^[a-z0-9-]*$/),
  utm_source: z.string().max(100),
  utm_medium: z.string().max(100),
  utm_campaign: z.string().max(100),
  landing_page: z.string().max(500),
  client_submission_id: z.string().max(36),
  form_started_at: z.number().int().optional(),
}).strict();

const reviewSchema = contactSchema.omit({ project_type: true, form_variant: true }).extend({
  website: z.string().min(1).max(500),
  project_type: z.string().max(100),
  form_variant: z.literal("website_review"),
}).strict();

export type Validation =
  | { ok: true; lead: LeadInput; stripped: string[]; spam?: "honeypot" | "timing" }
  | { ok: false; status: 400 | 413; error: string; fields: string[] };

export function validateLead(raw: unknown, options: { now: number; minFillMs: number; origins: string[] }): Validation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, status: 400, error: "Invalid request body", fields: [] };
  }
  const record = raw as Record<string, unknown>;
  const stripped = Object.keys(record).filter((key) => !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number]));
  if (clean(record.faxNumber)) {
    const email = clean(record.email).toLowerCase();
    return {
      ok: true,
      stripped,
      spam: "honeypot",
      lead: placeholderLead(email, clean(record.form_variant) === "website_review" ? "website_review" : "contact"),
    };
  }

  const variant = clean(record.form_variant);
  const timelineRaw = clean(record.timeline);
  const timeline = LEGACY_TIMELINE[timelineRaw] ?? timelineRaw;
  const websiteRaw = clean(record.website);
  const website = websiteRaw ? normalizeHttpUrl(websiteRaw) : "";
  if (websiteRaw && website == null) return { ok: false, status: 400, error: "Please check the form.", fields: ["website"] };

  const candidate = {
    first_name: clean(record.first_name),
    last_name: clean(record.last_name),
    email: clean(record.email).toLowerCase(),
    phone: clean(record.phone),
    company: clean(record.company),
    website: website ?? "",
    project_type: clean(record.project_type),
    timeline,
    budget: clean(record.budget),
    message: clean(record.message, true),
    consent: record.consent === true || clean(record.consent) === "true" ? true : false,
    form_variant: variant,
    source: clean(record.source).toLowerCase(),
    utm_source: clean(record.utm_source),
    utm_medium: clean(record.utm_medium),
    utm_campaign: clean(record.utm_campaign),
    landing_page: ownOrigin(clean(record.landing_page), options.origins),
    client_submission_id: clean(record.client_submission_id),
    form_started_at: typeof record.form_started_at === "number" && Number.isFinite(record.form_started_at)
      ? Math.trunc(record.form_started_at)
      : undefined,
  };

  const parsed = variant === "website_review" ? reviewSchema.safeParse(candidate) : contactSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] || "form")))];
    return { ok: false, status: 400, error: "Please check the form.", fields };
  }

  const lead = parsed.data as LeadInput;
  const started = lead.form_started_at;
  if (started != null) {
    const age = options.now - started;
    if (age >= 0 && age < options.minFillMs && age <= 24 * 60 * 60 * 1000) {
      return { ok: true, lead, stripped, spam: "timing" };
    }
  }
  return { ok: true, lead, stripped };
}

function placeholderLead(email: string, form_variant: LeadInput["form_variant"]): LeadInput {
  return {
    first_name: "", last_name: "", email, phone: "", company: "", website: "", project_type: "", timeline: "",
    budget: "", message: "", consent: true, form_variant, source: "", utm_source: "", utm_medium: "", utm_campaign: "",
    landing_page: "", client_submission_id: "",
  };
}

export function bodyTooLarge(contentLength: string | null, raw: string): boolean {
  const declared = Number(contentLength || 0);
  return (Number.isFinite(declared) && declared > BODY_LIMIT) || raw.length > BODY_LIMIT;
}

export { BODY_LIMIT };
