export const STEP_NAMES = ["contact", "owner", "company", "note", "task", "notify", "webhook"] as const;
export type StepName = (typeof STEP_NAMES)[number];
export type StepStatus = "pending" | "done" | "skipped" | "unknown" | "deferred" | "failed" | "blocked_needs_owner";

export type StepState = { status: StepStatus; at?: string; ref?: string; err?: string };

export type LeadInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  project_type: string;
  timeline: string;
  budget: string;
  message: string;
  consent: true;
  form_variant: "contact" | "website_review";
  source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  landing_page: string;
  client_submission_id: string;
  form_started_at?: number;
};

export type CipherPayload = { iv: string; tag: string; data: string };

export type SubmissionState = "queued" | "processing" | "completed" | "retry_scheduled" | "dead_letter";

export type SubmissionRecord = {
  v: 1;
  subKey: string;
  state: SubmissionState;
  attempts: number;
  nextAttemptAt: number;
  createdAt: string;
  updatedAt: string;
  steps: Record<StepName, StepState>;
  contactId?: string;
  taskId?: string;
  notifyMessageId?: string;
  lastErrorClass?: "retryable" | "permanent" | "config";
  payload: CipherPayload;
};

export type StoredLead = {
  lead: LeadInput;
  ipHash?: string;
  consent: { at: string; version: string };
  receivedAt: number;
};

export function emptySteps(): Record<StepName, StepState> {
  return {
    contact: { status: "pending" },
    owner: { status: "pending" },
    company: { status: "pending" },
    note: { status: "pending" },
    task: { status: "pending" },
    notify: { status: "pending" },
    webhook: { status: "pending" },
  };
}
