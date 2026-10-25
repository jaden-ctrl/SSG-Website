import { outboundFetch, outboundSmtp } from "@/lib/gateway";
import type { ModeDecision } from "@/lib/runtime-mode";
import { logLead } from "@/lib/lead/log";

export type Mail = { to: string[]; from: string; subject: string; text: string; idempotencyKey: string };
export type Mailer = { send(mail: Mail): Promise<{ id?: string; skipped?: string; status: number }> };

export function createMailer(decision: ModeDecision, env: NodeJS.ProcessEnv = process.env): Mailer {
  return {
    async send(mail) {
      if (decision.block || decision.mode === "mock") return { id: `mock-${mail.idempotencyKey}`, status: 200 };
      if (decision.mode === "live-test") {
        if (!env.RESEND_TEST_API_KEY || !mail.to.length) return { skipped: "notify_unconfigured", status: 0 };
        const response = await outboundFetch({
          channel: "resend",
          path: "/emails",
          method: "POST",
          recipients: mail.to,
          idempotencyKey: mail.idempotencyKey,
          body: JSON.stringify({ from: mail.from, to: mail.to, subject: mail.subject, text: mail.text }),
          timeoutMs: 8_000,
        });
        if (response.headers.get("X-SSG-Outbound") === "mock") return { skipped: "notify_unconfigured", status: 0 };
        const data = await response.json().catch(() => null) as { id?: string } | null;
        return response.ok ? { id: data?.id, status: response.status } : { status: response.status };
      }
      if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_FROM && env.NOTIFY_EMAIL_TO) {
        const response = await outboundFetch({
          channel: "resend",
          path: "/emails",
          method: "POST",
          recipients: mail.to,
          idempotencyKey: mail.idempotencyKey,
          body: JSON.stringify({ from: mail.from, to: mail.to, subject: mail.subject, text: mail.text }),
          timeoutMs: 8_000,
        });
        const data = await response.json().catch(() => null) as { id?: string } | null;
        if (!response.ok) return { status: response.status };
        return { id: data?.id, status: response.status };
      }
      if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.NOTIFY_EMAIL_FROM) {
        const sent = await outboundSmtp({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT || 465),
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
          from: mail.from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
        });
        return sent.mocked ? { skipped: "notify_unconfigured", status: 0 } : { id: sent.id, status: 250 };
      }
      logLead("warn", "notify_unconfigured", { step: "notify" });
      return { skipped: "notify_unconfigured", status: 0 };
    },
  };
}
