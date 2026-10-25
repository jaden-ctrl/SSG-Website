import type { JsonStore } from "@/lib/blob-store";
import { hmacHex } from "@/lib/lead/crypto";
import { logLead } from "@/lib/lead/log";

export async function enforceRateLimit(input: {
  store: JsonStore;
  now: number;
  salt: string | undefined;
  ip: string | undefined;
  email: string;
  limits: { ip: number; email: number; global: number };
}): Promise<{ status: "ok" | "limited" | "open"; retryAfter: number }> {
  const retryAfter = Math.max(1, Math.ceil((600_000 - (input.now % 600_000)) / 1000));
  if (!input.salt || input.salt.length < 32) {
    logLead("warn", "lead_ratelimit_unavailable", { reason: "salt", variable: "LEAD_HASH_SALT" });
    return { status: "open", retryAfter };
  }
  try {
    const window = Math.floor(input.now / 600_000);
    const checks: [string, number][] = [];
    if (input.ip) checks.push([`rl/ip/${window}/${hmacHex(input.salt, input.ip)}`, input.limits.ip]);
    checks.push([`rl/em/${window}/${hmacHex(input.salt, input.email.toLowerCase())}`, input.limits.email]);
    checks.push([`rl/all/${window}`, input.limits.global]);
    for (const [key, limit] of checks) {
      const allowed = await bump(input.store, key, limit);
      if (!allowed) return { status: "limited", retryAfter };
    }
    return { status: "ok", retryAfter };
  } catch {
    logLead("warn", "lead_ratelimit_unavailable", { reason: "store" });
    return { status: "open", retryAfter };
  }
}

async function bump(store: JsonStore, key: string, limit: number): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await store.getWithMetadata(key);
    const count = current ? Number((current.data as { n?: number })?.n || 0) : 0;
    if (count >= limit) return false;
    const write = current?.etag
      ? await store.setJSON(key, { n: count + 1 }, { onlyIfMatch: current.etag })
      : await store.setJSON(key, { n: 1 }, { onlyIfNew: true });
    if (write.modified) return true;
  }
  return true;
}

export function clientIp(headers: Headers): string | undefined {
  const netlify = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || undefined;
}
