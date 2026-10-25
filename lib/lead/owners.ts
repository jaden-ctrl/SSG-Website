import type { JsonStore } from "@/lib/blob-store";
import type { Crm } from "@/lib/lead/crm";
import { errorClass } from "@/lib/lead/crm";
import { logLead } from "@/lib/lead/log";

const memory = new Map<string, { valid: boolean; at: number }>();

export async function resolveOwner(input: {
  crm: Crm;
  store: JsonStore;
  candidates: string[];
  now?: number;
}): Promise<{ ownerId?: string; status: "ready" | "unknown" | "blocked" }> {
  const now = input.now ?? Date.now();
  for (const id of input.candidates) {
    if (!/^\d+$/.test(id)) continue;
    const verdict = await ownerValid(input.crm, input.store, id, now);
    if (verdict === "valid") return { ownerId: id, status: "ready" };
    if (verdict === "unknown") return { status: "unknown" };
    if (verdict === "blocked") return { status: "blocked" };
  }
  logLead("error", "owner_unresolved", { reason: "no_valid_owner" });
  return { status: "blocked" };
}

async function ownerValid(crm: Crm, store: JsonStore, id: string, now: number): Promise<"valid" | "invalid" | "unknown" | "blocked"> {
  const cached = memory.get(id);
  if (cached && now - cached.at < 10 * 60 * 1000) return cached.valid ? "valid" : "invalid";
  const blobKey = `cache/owner/${id}`;
  const stored = await store.get(blobKey) as { valid?: boolean; checkedAt?: number } | null;
  const result = await crm.request("GET", `/crm/v3/owners/${id}?idProperty=id&archived=false`, undefined, "safe");
  if (result.status === 403) {
    logLead("error", "owner_scope_missing", { step: "owner" });
    return "blocked";
  }
  if (result.networkError || result.status >= 500 || result.status === 429) {
    if (stored?.checkedAt && now - stored.checkedAt < (stored.valid ? 86_400_000 : 3_600_000)) {
      return stored.valid ? "valid" : "invalid";
    }
    if (errorClass(result) === "retryable") return "unknown";
  }
  const valid = result.status === 200 && (result.data as { archived?: boolean })?.archived === false;
  memory.set(id, { valid, at: now });
  await store.setJSON(blobKey, { valid, checkedAt: now });
  return valid ? "valid" : "invalid";
}

export function resetOwnerCache() {
  memory.clear();
}
