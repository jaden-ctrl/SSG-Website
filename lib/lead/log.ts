const SENSITIVE_KEY = /email|token|secret|authorization|password|message|phone|name|ip|body|payload|key/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function logLead(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string" && (EMAIL.test(value) || value.length > 300)) continue;
    safe[key] = value;
  }
  const line = JSON.stringify(safe);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
