import { openJsonStore } from "../../lib/blob-store";
import { createLiveCrm } from "../../lib/lead/crm";
import { createMailer } from "../../lib/lead/notify";
import { runDue } from "../../lib/lead/processor";
import { currentDecision } from "../../lib/runtime-mode";

/**
 * Production scheduled retry. Netlify runs scheduled functions only on the
 * published production deploy. Mock and blocked modes return without calling
 * HubSpot, email, or webhooks. Each run drains up to 8 due records and stops
 * around 22s, then purges expired submissions, dead letters, spam, rate-limit
 * windows, and locks.
 */
export const config = { schedule: "*/10 * * * *" };

export default async function leadRetry() {
  const decision = currentDecision();
  if (decision.mode === "mock" || decision.block) return;
  await runDue({
    store: openJsonStore("lead-intake", { strong: true }),
    crm: createLiveCrm(),
    mailer: createMailer(decision),
    env: process.env,
    now: () => Date.now(),
    decision,
  });
}
