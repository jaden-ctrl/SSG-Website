import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Intake, PartialAudit } from "../schemas";
import { SSGAI_AGENT_RELEASE, SSG_BRAIN_BASELINE } from "../governance/manifest";
import { openNetlifyStore } from "../storage/netlify";
import { storageBackend } from "../storage/runtime";

export type CaseState =
  | "PROSPECT_RECEIVED"
  | "CONSENT_AND_AUTHORITY_RECORDED"
  | "INTAKE_VALIDATED"
  | "AUDIT_CASE_OPENED"
  | "DOMAIN_ANALYSIS"
  | "QA_PENDING"
  | "PREVIEW_APPROVED"
  | "PREVIEW_RELEASED"
  | "NEEDS_CLIENT_INPUT"
  | "MANUAL_REVIEW"
  | "FAILED_RECOVERABLE";

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
  review?: {
    reviewer: string;
    decision: "approved" | "rejected";
    decidedAt: string;
    notes?: string;
  };
  failure?: { code: string; recordedAt: string };
};

export interface CaseRepository {
  save(record: AuditCase): Promise<void>;
  saveIfVersion(record: AuditCase, expectedVersion: number): Promise<boolean>;
  get(caseId: string): Promise<AuditCase | null>;
  listByState(state: CaseState): Promise<AuditCase[]>;
}

class LocalCases implements CaseRepository {
  private dir = path.join(process.cwd(), "data", "cases");

  async save(record: AuditCase) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, `${record.caseId}.json`), JSON.stringify(record, null, 2), "utf8");
  }

  async saveIfVersion(record: AuditCase, expectedVersion: number) {
    const current = await this.get(record.caseId);
    if (!current || current.version !== expectedVersion) return false;
    await this.save(record);
    return true;
  }

  async get(caseId: string) {
    try {
      return JSON.parse(await readFile(path.join(this.dir, `${caseId}.json`), "utf8")) as AuditCase;
    } catch {
      return null;
    }
  }

  async listByState(state: CaseState) {
    try {
      const names = await readdir(this.dir);
      const records = await Promise.all(
        names.filter((name) => name.endsWith(".json")).map(async (name) => {
          try {
            return JSON.parse(await readFile(path.join(this.dir, name), "utf8")) as AuditCase;
          } catch {
            return null;
          }
        }),
      );
      return records.filter((record): record is AuditCase => record?.state === state);
    } catch {
      return [];
    }
  }
}

class NetlifyCases implements CaseRepository {
  private get store() {
    return openNetlifyStore("ssgai-cases");
  }

  async save(record: AuditCase) {
    await this.store.setJSON(record.caseId, record);
  }

  async saveIfVersion(record: AuditCase, expectedVersion: number) {
    const entry = await this.store.getWithMetadata(record.caseId, {
      type: "json",
      consistency: "strong",
    });
    const current = entry?.data as AuditCase | null | undefined;
    if (!entry?.etag || !current || current.version !== expectedVersion) return false;
    const result = await this.store.setJSON(record.caseId, record, { onlyIfMatch: entry.etag });
    return result.modified;
  }

  async get(caseId: string) {
    return (await this.store.get(caseId, {
      type: "json",
      consistency: "strong",
    })) as AuditCase | null;
  }

  async listByState(state: CaseState) {
    const { blobs } = await this.store.list();
    const records = await Promise.all(blobs.map(({ key }) => this.get(key)));
    return records.filter((record): record is AuditCase => record?.state === state);
  }
}

function repository(): CaseRepository {
  return storageBackend() === "netlify" ? new NetlifyCases() : new LocalCases();
}

export const cases: CaseRepository = {
  save(record) {
    return repository().save(record);
  },
  saveIfVersion(record, expectedVersion) {
    return repository().saveIfVersion(record, expectedVersion);
  },
  get(caseId) {
    return repository().get(caseId);
  },
  listByState(state) {
    return repository().listByState(state);
  },
};

export function transition(
  record: AuditCase,
  expected: CaseState,
  next: CaseState,
  patch: Partial<AuditCase> = {},
): AuditCase {
  if (record.state !== expected) throw new Error(`Invalid case transition ${record.state} -> ${next}`);
  return {
    ...record,
    ...patch,
    state: next,
    version: record.version + 1,
    updatedAt: new Date().toISOString(),
  };
}
