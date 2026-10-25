import { createHash } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeMessage(message: string): string {
  return message.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function submissionKey(input: {
  clientSubmissionId?: string;
  email: string;
  formVariant: string;
  message: string;
  receivedAtMs: number;
}): string {
  const email = input.email.trim().toLowerCase();
  if (input.clientSubmissionId && UUID.test(input.clientSubmissionId)) {
    return sha256(`ssg-lead-v1|cid|${input.clientSubmissionId}|${email}`);
  }
  const bucket = Math.floor(input.receivedAtMs / 600_000);
  return sha256(`ssg-lead-v1|fb|${email}|${input.formVariant}|${sha256(normalizeMessage(input.message))}|${bucket}`);
}

export function keyTag(subKey: string): string {
  return subKey.slice(0, 16);
}
