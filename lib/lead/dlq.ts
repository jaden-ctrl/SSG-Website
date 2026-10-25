import type { JsonStore } from "../blob-store";
import type { SubmissionRecord } from "./types";

export type DeadLetterRow = { subKey: string; reason?: string; at?: string; code?: string };

/** List dead-letter markers. The encrypted payload is not returned. */
export async function listDeadLetters(store: JsonStore): Promise<DeadLetterRow[]> {
  const listed = await store.list({ prefix: "dlq/" });
  const rows: DeadLetterRow[] = [];
  for (const blob of listed.blobs) {
    const data = await store.get(blob.key) as { reason?: string; at?: string; code?: string } | null;
    rows.push({
      subKey: blob.key.slice("dlq/".length),
      reason: data?.reason,
      at: data?.at,
      code: data?.code,
    });
  }
  return rows;
}

/**
 * Put a dead-lettered submission back on the retry queue with a fresh attempt
 * budget. Returns false when the submission envelope is gone (a poison marker
 * with no record cannot be retried until the payload is restored).
 */
export async function requeueDeadLetter(store: JsonStore, subKey: string, now = Date.now()): Promise<boolean> {
  const current = await store.getWithMetadata(`sub/${subKey}`);
  if (!current) return false;
  const record = current.data as SubmissionRecord;
  if (!record || record.v !== 1) return false;
  record.state = "queued";
  record.attempts = 0;
  record.nextAttemptAt = 0;
  record.updatedAt = new Date(now).toISOString();
  record.lastErrorClass = undefined;
  const written = await store.setJSON(`sub/${subKey}`, record, { onlyIfMatch: current.etag });
  if (!written.modified) return false;
  await store.setJSON(`queue/${subKey}`, { at: record.createdAt || record.updatedAt });
  await store.delete(`dlq/${subKey}`);
  return true;
}
