import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Intake, PartialAudit } from "@/lib/schemas";
import { memoryJsonStore, openJsonStore, planBlobStore } from "@/lib/blob-store";
import { outboundFetch } from "@/lib/gateway";

export type LeadRecord = Intake & { id: string; createdAt: string; status: "received" | "analyzed" | "analysis_failed"; audit?: PartialAudit };
export interface LeadAction { save(record: LeadRecord): Promise<void>; }

class LocalLeadAction implements LeadAction {
  async save(record: LeadRecord) {
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "leads.jsonl"), JSON.stringify(record) + "\n", "utf8");
  }
}

class StoreLeadAction implements LeadAction {
  logicalName: string;
  constructor(logicalName: string) { this.logicalName = logicalName; }
  async save(record: LeadRecord) {
    const plan = planBlobStore(this.logicalName);
    if (plan.kind === "local") {
      await new LocalLeadAction().save(record);
      return;
    }
    if (plan.kind === "memory") {
      await memoryJsonStore(plan.name).setJSON(record.id, record);
      return;
    }
    await openJsonStore(this.logicalName).setJSON(record.id, record);
  }
}

class WebhookLeadAction implements LeadAction {
  url: string;
  constructor(url: string) { this.url = url; }
  async save(record: LeadRecord) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.SSGAI_LEAD_WEBHOOK_SECRET) headers.authorization = `Bearer ${process.env.SSGAI_LEAD_WEBHOOK_SECRET}`;
    const response = await outboundFetch({
      channel: "webhook",
      policy: "legacy-ssgai",
      url: this.url,
      method: "POST",
      headers,
      body: JSON.stringify(record),
      timeoutMs: 8000,
    });
    if (response.headers.get("X-SSG-Outbound") === "mock") return;
    if (!response.ok) throw new Error(`Lead webhook failed (${response.status})`);
  }
}

async function syncHubSpot(record: LeadRecord) {
  if (!process.env.HUBSPOT_ACCESS_TOKEN && !process.env.HUBSPOT_TEST_ACCESS_TOKEN) return;
  const properties = {
    email: record.email,
    firstname: record.firstName,
    lastname: record.lastName,
    company: record.company,
    website: record.website || undefined,
    hs_lead_status: "NEW",
  };
  const response = await outboundFetch({
    channel: "hubspot",
    path: "/crm/v3/objects/contacts/batch/upsert",
    method: "POST",
    body: JSON.stringify({ inputs: [{ idProperty: "email", id: record.email, properties }] }),
    timeoutMs: 8000,
  });
  if (response.headers.get("X-SSG-Outbound") === "mock") return;
  if (!response.ok) throw new Error(`HubSpot sync failed (${response.status})`);
}

export async function captureLead(record: LeadRecord) {
  const plan = planBlobStore("ssgai-leads");
  const primary: LeadAction = plan.kind === "local" ? new LocalLeadAction() : new StoreLeadAction("ssgai-leads");
  await primary.save(record);
}

export async function projectReleasedLead(record: LeadRecord) {
  const optional = [syncHubSpot(record), ...(process.env.SSGAI_LEAD_WEBHOOK_URL ? [new WebhookLeadAction(process.env.SSGAI_LEAD_WEBHOOK_URL).save(record)] : [])];
  const results = await Promise.allSettled(optional);
  results.forEach((result) => {
    if (result.status === "rejected") {
      const reason = result.reason;
      console.error(JSON.stringify({ event: "lead_sync_failed", leadId: record.id, name: reason instanceof Error ? reason.name : "unknown" }));
    }
  });
}
