import { createMailer, type Mailer } from "@/lib/lead/notify";
import { logLead } from "@/lib/lead/log";
import type { ModeDecision } from "@/lib/runtime-mode";

/** One ops email per code per window. The structured log is always written. */
export const OPS_ALERT_TTL_MS = 10 * 60 * 1000;

const sentAt = new Map<string, number>();

export function resetOpsAlerts() {
  sentAt.clear();
}

/**
 * Loud log plus a rate-limited email when a mailer can actually send.
 * Mock mode logs only, so a production-host mismatch cannot call Resend.
 */
export async function alertOps(input: {
  code: string;
  decision: ModeDecision;
  env?: NodeJS.ProcessEnv;
  mailer?: Mailer;
  now?: number;
}): Promise<void> {
  const code = input.code;
  logLead("error", "lead_ops_alert", { code });
  const now = input.now ?? Date.now();
  const previous = sentAt.get(code);
  if (previous != null && now - previous < OPS_ALERT_TTL_MS) return;
  sentAt.set(code, now);
  if (input.decision.mode === "mock" || input.decision.block) return;
  try {
    const env = input.env ?? process.env;
    const mailer = input.mailer ?? createMailer(input.decision, env);
    const liveTest = input.decision.mode === "live-test";
    const to = ((liveTest ? env.NOTIFY_EMAIL_TEST_TO : env.NOTIFY_EMAIL_TO) || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const from = (liveTest ? env.NOTIFY_EMAIL_TEST_FROM || env.NOTIFY_EMAIL_FROM : env.NOTIFY_EMAIL_FROM) || "";
    if (!to.length || !from) return;
    await mailer.send({
      to,
      from,
      subject: "[SSG intake] Lead system needs attention",
      idempotencyKey: `ops:${code}:${Math.floor(now / OPS_ALERT_TTL_MS)}`,
      text: [`code:${code}`, "A lead was not confirmed. Check the function log for the same code."].join("\n"),
    });
  } catch {
    logLead("error", "lead_ops_alert", { code: "lead_ops_alert_failed" });
  }
}
