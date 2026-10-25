import type { JsonStore } from "../blob-store";
import type { Crm } from "./crm";
import { keyTag } from "./subkey";
import { logLead } from "./log";

export const TASK_SUBJECT_PREFIX = "SSG Web Inquiry:";
const TASK_CONTACT = 204;
const NOTE_CONTACT = 202;

type TaskProps = { hs_task_status?: string; hs_task_subject?: string; hs_task_body?: string; hubspot_owner_id?: string; hs_timestamp?: string };

export type TaskOutcome = "created" | "appended" | "deferred" | "blocked" | "unknown";

function rows(data: unknown): { id: string; properties?: TaskProps; createdAt?: string }[] {
  const results = (data as { results?: { id?: string; toObjectId?: string; properties?: TaskProps; createdAt?: string }[] })?.results || [];
  return results.map((row) => ({ id: String(row.id || row.toObjectId || ""), properties: row.properties, createdAt: row.createdAt }));
}

async function readTasks(crm: Crm, ids: string[]) {
  if (!ids.length) return [];
  const result = await crm.request("POST", "/crm/v3/objects/tasks/batch/read", {
    properties: ["hs_task_status", "hs_task_subject", "hs_task_body", "hubspot_owner_id", "hs_timestamp"],
    inputs: ids.map((id) => ({ id })),
  }, "safe");
  if (result.status >= 400 || result.networkError) return null;
  return rows(result.data).filter((row) => row.id);
}

async function openTasks(crm: Crm, contactId: string) {
  const listed = await crm.request("GET", `/crm/v4/objects/contacts/${contactId}/associations/tasks`, undefined, "safe");
  if (listed.networkError || listed.status >= 400) return null;
  const ids = rows(listed.data).map((row) => row.id).filter(Boolean);
  const tasks = await readTasks(crm, ids);
  if (!tasks) return null;
  return tasks.filter((task) => (task.properties?.hs_task_subject || "").startsWith(TASK_SUBJECT_PREFIX) && task.properties?.hs_task_status !== "COMPLETED");
}

async function withLock(store: JsonStore, contactId: string, subKey: string, retryMs: number, fn: () => Promise<TaskOutcome>): Promise<TaskOutcome> {
  const key = `lock/contact-task/${contactId}`;
  const acquire = async () => {
    const now = Date.now();
    const created = await store.setJSON(key, { holder: subKey, expiresAt: now + 45_000 }, { onlyIfNew: true });
    if (created.modified) return true;
    const current = await store.getWithMetadata(key);
    const value = current?.data as { holder?: string; expiresAt?: number } | undefined;
    if (value?.expiresAt && value.expiresAt <= now && current?.etag) {
      const stolen = await store.setJSON(key, { holder: subKey, expiresAt: now + 45_000 }, { onlyIfMatch: current.etag });
      return stolen.modified;
    }
    return false;
  };
  if (!await acquire()) {
    await new Promise((resolve) => setTimeout(resolve, retryMs));
    if (!await acquire()) return "deferred";
  }
  try {
    return await fn();
  } finally {
    const current = await store.get(key) as { holder?: string } | null;
    if (current?.holder === subKey) await store.delete(key);
  }
}

export async function ensureInquiryTask(input: {
  crm: Crm;
  store: JsonStore;
  contactId: string;
  subKey: string;
  ownerId: string;
  subject: string;
  body: string;
  dueMs: number;
  lockRetryMs?: number;
  now?: number;
}): Promise<{ outcome: TaskOutcome; taskId?: string }> {
  const now = input.now ?? Date.now();
  const outcome = await withLock(input.store, input.contactId, input.subKey, input.lockRetryMs ?? 2_000, () => runLocked({ ...input, now }));
  const marker = await input.store.get(`marker/contact-task/${input.contactId}`) as { taskId?: string | null } | null;
  return { outcome, taskId: marker?.taskId || undefined };
}

async function runLocked(input: {
  crm: Crm;
  store: JsonStore;
  contactId: string;
  subKey: string;
  ownerId: string;
  subject: string;
  body: string;
  dueMs: number;
  now: number;
}): Promise<TaskOutcome> {
  const markerKey = `marker/contact-task/${input.contactId}`;
  const marker = await input.store.get(markerKey) as { taskId?: string | null; state?: string; subKey?: string; updatedAt?: number } | null;
  const wantedKey = marker?.state === "creating" && marker.subKey ? marker.subKey : input.subKey;

  if (marker?.state === "open" && marker.taskId) {
    const current = await input.crm.request("GET", `/crm/v3/objects/tasks/${marker.taskId}`, undefined, "safe");
    if (current.status === 404 || (current.data as { properties?: TaskProps })?.properties?.hs_task_status === "COMPLETED") {
      await input.store.delete(markerKey);
    } else if (!current.networkError && current.status < 400) {
      const body = (current.data as { properties?: TaskProps })?.properties?.hs_task_body || "";
      if (!body.includes(`ssg-key:${keyTag(input.subKey)}`)) await appendFollowUp(input, marker.taskId, current.data as { properties?: TaskProps });
      return "appended";
    } else if (current.networkError || current.status >= 500) return "unknown";
  }

  const open = await openTasks(input.crm, input.contactId);
  if (open == null) return "unknown";
  const tagged = open.find((task) => (task.properties?.hs_task_body || "").includes(`ssg-key:${keyTag(wantedKey)}`));
  const oldest = [...open].sort((a, b) => Number(a.createdAt || a.id) - Number(b.createdAt || b.id))[0];
  const adopted = tagged || oldest;
  if (adopted) {
    await input.store.setJSON(markerKey, { taskId: adopted.id, state: "open", subKey: input.subKey, updatedAt: input.now });
    for (const extra of open.filter((task) => task.id !== adopted.id)) {
      await input.crm.request("PATCH", `/crm/v3/objects/tasks/${extra.id}`, {
        properties: { hs_task_status: "COMPLETED", hs_task_body: `${extra.properties?.hs_task_body || ""}\nAuto-closed duplicate of ${adopted.id}` },
      }, "safe");
      logLead("warn", "lead_task_duplicate_closed", { submission_id: input.subKey.slice(0, 12) });
    }
    if (marker?.state === "creating") return "created";
    if (adopted.id !== marker?.taskId) {
      await appendFollowUp(input, adopted.id, adopted);
      return "appended";
    }
    return "appended";
  }

  if (marker?.state === "creating" && input.now - (marker.updatedAt || 0) < 120_000) return "deferred";
  if (!input.ownerId) return "blocked";
  await input.store.setJSON(markerKey, { taskId: null, state: "creating", subKey: input.subKey, updatedAt: input.now });
  const created = await input.crm.request("POST", "/crm/v3/objects/tasks", {
    properties: {
      hs_timestamp: new Date(input.dueMs).toISOString(),
      hubspot_owner_id: input.ownerId,
      hs_task_subject: input.subject,
      hs_task_status: "NOT_STARTED",
      hs_task_priority: "HIGH",
      hs_task_type: "TODO",
      hs_task_body: `${input.body}\nssg-key:${keyTag(input.subKey)}`,
    },
    associations: [{ to: { id: input.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: TASK_CONTACT }] }],
  }, "never");
  if (created.networkError || created.status === 0) return "unknown";
  if (created.status >= 400) return created.status === 429 ? "deferred" : "unknown";
  const taskId = (created.data as { id?: string })?.id;
  if (!taskId) return "unknown";
  await input.store.setJSON(markerKey, { taskId, state: "open", subKey: input.subKey, updatedAt: input.now });
  const again = await openTasks(input.crm, input.contactId);
  if (again && again.length > 1) {
    const keep = [...again].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))[0];
    for (const extra of again.filter((task) => task.id !== keep.id)) {
      await input.crm.request("PATCH", `/crm/v3/objects/tasks/${extra.id}`, {
        properties: { hs_task_status: "COMPLETED", hs_task_body: `${extra.properties?.hs_task_body || ""}\nAuto-closed duplicate of ${keep.id}` },
      }, "safe");
      logLead("warn", "lead_task_duplicate_closed", { submission_id: input.subKey.slice(0, 12) });
    }
  }
  return "created";
}

async function appendFollowUp(input: { crm: Crm; body: string; dueMs: number; subKey: string }, taskId: string, task: { properties?: TaskProps }) {
  const currentDue = Date.parse(task.properties?.hs_timestamp || "") || 0;
  const due = Math.max(currentDue, input.dueMs);
  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const tag = `ssg-key:${keyTag(input.subKey)}`;
  await input.crm.request("PATCH", `/crm/v3/objects/tasks/${taskId}`, {
    properties: {
      hs_timestamp: new Date(due).toISOString(),
      hs_task_body: `${task.properties?.hs_task_body || ""}\nFollow-up inquiry ${stamp} (see note)\n${tag}`,
    },
  }, "safe");
}

export async function createNote(crm: Crm, contactId: string, subKey: string, html: string): Promise<"done" | "unknown"> {
  const tag = `ssg-key:${keyTag(subKey)}`;
  const listed = await crm.request("GET", `/crm/v4/objects/contacts/${contactId}/associations/notes`, undefined, "safe");
  if (!listed.networkError && listed.status < 400) {
    const ids = rows(listed.data).map((row) => row.id).filter(Boolean);
    if (ids.length) {
      const notes = await crm.request("POST", "/crm/v3/objects/notes/batch/read", {
        properties: ["hs_note_body"],
        inputs: ids.map((id) => ({ id })),
      }, "safe");
      const found = rows(notes.data).some((note) => (note.properties as { hs_note_body?: string } | undefined)?.hs_note_body?.includes(tag));
      if (found) return "done";
    }
  }
  const created = await crm.request("POST", "/crm/v3/objects/notes", {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `${html}<br>${tag}` },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_CONTACT }] }],
  }, "never");
  if (created.networkError || created.status === 0 || created.status >= 400) return "unknown";
  return "done";
}

export { TASK_CONTACT, NOTE_CONTACT };
