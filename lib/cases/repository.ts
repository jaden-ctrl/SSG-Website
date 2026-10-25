import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Intake, PartialAudit } from "@/lib/schemas";
import { SSGAI_AGENT_RELEASE, SSG_BRAIN_BASELINE } from "@/lib/governance/manifest";
import { memoryJsonStore, openJsonStore, planBlobStore, type JsonStore } from "@/lib/blob-store";

export type CaseState = "PROSPECT_RECEIVED" | "CONSENT_AND_AUTHORITY_RECORDED" | "INTAKE_VALIDATED" | "AUDIT_CASE_OPENED" | "DOMAIN_ANALYSIS" | "QA_PENDING" | "PREVIEW_APPROVED" | "PREVIEW_RELEASED" | "NEEDS_CLIENT_INPUT" | "MANUAL_REVIEW" | "FAILED_RECOVERABLE";
export type AuditCase = {
  caseId: string;
  tenantId: string;
  accessTokenHash: string;
  version: number;
  state: CaseState;
  createdAt: string;
  updatedAt: string;
  intake: Intake;
  inputSnapshotHash: string;
  consent: { noticeVersion: string; purpose: string; recordedAt: string };
  governance: typeof SSG_BRAIN_BASELINE & typeof SSGAI_AGENT_RELEASE;
  previewCandidate?: PartialAudit;
  releasedPreview?: PartialAudit;
  review?: { reviewer: string; decision: "approved" | "rejected"; decidedAt: string; notes?: string };
  failure?: { code: string; recordedAt: string };
};

interface CaseRepository {
  save(record: AuditCase): Promise<void>;
  get(caseId: string): Promise<AuditCase | null>;
}

class LocalCases implements CaseRepository {
  private dir = path.join(process.cwd(), "data", "cases");
  async save(record: AuditCase) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, `${record.caseId}.json`), JSON.stringify(record, null, 2), "utf8");
  }
  async get(caseId: string) {
    try {
      return JSON.parse(await readFile(path.join(this.dir, `${caseId}.json`), "utf8")) as AuditCase;
    } catch {
      return null;
    }
  }
}

class StoreCases implements CaseRepository {
  store: JsonStore;
  constructor(store: JsonStore) { this.store = store; }
  async save(record: AuditCase) {
    await this.store.setJSON(record.caseId, record);
  }
  async get(caseId: string) {
    return (await this.store.get(caseId)) as AuditCase | null;
  }
}

function repository(): CaseRepository {
  const plan = planBlobStore("ssgai-cases");
  if (plan.kind === "local") return new LocalCases();
  if (plan.kind === "memory") return new StoreCases(memoryJsonStore(plan.name));
  return new StoreCases(openJsonStore("ssgai-cases"));
}

export const cases: CaseRepository = {
  save(record) { return repository().save(record); },
  get(caseId) { return repository().get(caseId); },
};

export function transition(record: AuditCase, expected: CaseState, next: CaseState, patch: Partial<AuditCase> = {}): AuditCase {
  if (record.state !== expected) throw new Error(`Invalid case transition ${record.state} -> ${next}`);
  return { ...record, ...patch, state: next, version: record.version + 1, updatedAt: new Date().toISOString() };
}
