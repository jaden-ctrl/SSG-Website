import { openJsonStore } from "../lib/blob-store";
import { listDeadLetters, requeueDeadLetter } from "../lib/lead/dlq";

/**
 * Recovery for dead-lettered leads. Same operations as GET/POST /api/admin/lead-dlq.
 *
 *   node --experimental-strip-types --import ./tests/register.mjs scripts/lead-dlq.ts list
 *   node --experimental-strip-types --import ./tests/register.mjs scripts/lead-dlq.ts requeue <subKey>
 *
 * On a production deploy the store is the site blob store only when this process
 * resolves to live mode (production bake and an allowlisted host or URL).
 * A poison payload stays undecryptable until LEAD_STORE_KEY matches the record;
 * requeue puts it back and the retry loop isolates it again instead of blocking.
 */
async function main() {
  const [command, subKey] = process.argv.slice(2);
  const store = openJsonStore("lead-intake", { strong: true });
  if (command === "list") {
    console.log(JSON.stringify({ ok: true, records: await listDeadLetters(store) }));
    return;
  }
  if (command === "requeue" && subKey && !subKey.includes("/")) {
    const moved = await requeueDeadLetter(store, subKey);
    console.log(JSON.stringify({ ok: moved, code: moved ? "lead_dead_letter_requeued" : "lead_not_found", subKey }));
    if (!moved) process.exitCode = 1;
    return;
  }
  console.error(JSON.stringify({ ok: false, code: "lead_invalid", error: "Use list or requeue <subKey>" }));
  process.exitCode = 1;
}

const entry = process.argv[1] || "";
if (entry.endsWith("lead-dlq.ts") || entry.endsWith("lead-dlq.mts")) {
  void main();
}
