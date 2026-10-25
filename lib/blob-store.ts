import { getDeployStore, getStore } from "@netlify/blobs";
import {
  currentRequestHost,
  decideRuntimeMode,
  hostFromUrl,
  readBuildContext,
  type Env,
} from "./runtime-mode";

/**
 * Production blob names are used only in live mode. Preview and other
 * non-production runs stay in memory so they cannot read or write the
 * site-wide production store. An explicit live test uses a deploy-scoped
 * store with a distinct name.
 */

export type BlobPlan =
  | { kind: "memory"; name: string }
  | { kind: "local" }
  | { kind: "site"; name: string }
  | { kind: "deploy"; name: string };

export type ConditionalWrite = { onlyIfNew?: boolean; onlyIfMatch?: string };

export type JsonStore = {
  get(key: string): Promise<unknown | null>;
  getWithMetadata(key: string): Promise<{ data: unknown; etag: string } | null>;
  setJSON(key: string, value: unknown, options?: ConditionalWrite): Promise<{ modified: boolean; etag?: string }>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
};

type MemoryBucket = Map<string, { value: unknown; etag: string }>;
const memoryBuckets = new Map<string, MemoryBucket>();
let etagSequence = 0;

export function resetMemoryStoresForTests() {
  memoryBuckets.clear();
  etagSequence = 0;
}

export function planBlobStore(logicalName: string, env: Env = process.env, buildContext = readBuildContext()): BlobPlan {
  const requestHost = currentRequestHost();
  const host = requestHost === undefined ? hostFromUrl(env.URL) : requestHost;
  const decision = decideRuntimeMode({ buildContext, runtimeContext: env.CONTEXT, host, env });
  if (decision.mode === "live" && decision.block == null) {
    return env.NETLIFY ? { kind: "site", name: logicalName } : { kind: "local" };
  }
  if (decision.mode === "live-test" && decision.block == null) {
    const name = `${logicalName}--livetest`;
    return env.NETLIFY ? { kind: "deploy", name } : { kind: "memory", name };
  }
  if (env.NETLIFY) return { kind: "memory", name: `${logicalName}--mock` };
  return { kind: "local" };
}

function bucketStore(bucket: MemoryBucket): JsonStore {
  return {
    async get(key) {
      return bucket.get(key)?.value ?? null;
    },
    async getWithMetadata(key) {
      const found = bucket.get(key);
      if (!found) return null;
      return { data: found.value, etag: found.etag };
    },
    async setJSON(key, value, options) {
      const current = bucket.get(key);
      if (options?.onlyIfNew && current) return { modified: false, etag: current.etag };
      if (options?.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false, etag: current?.etag };
      const etag = `m${++etagSequence}`;
      bucket.set(key, { value, etag });
      return { modified: true, etag };
    },
    async delete(key) {
      bucket.delete(key);
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      return { blobs: [...bucket.keys()].filter((key) => key.startsWith(prefix)).sort().map((key) => ({ key })) };
    },
  };
}

export function memoryJsonStore(name: string): JsonStore {
  if (!memoryBuckets.has(name)) memoryBuckets.set(name, new Map());
  return bucketStore(memoryBuckets.get(name)!);
}

/** Request-local store. Never registered, so it cannot alias a production or preview bucket. */
export function privateJsonStore(): JsonStore {
  return bucketStore(new Map());
}

type NetlifyStore = {
  get(key: string, options: { type: "json"; consistency?: "strong" }): Promise<unknown>;
  getWithMetadata(key: string, options: { type: "json"; consistency?: "strong" }): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(key: string, value: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean; etag?: string }>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
};

function wrapNetlifyStore(store: NetlifyStore): JsonStore {
  return {
    async get(key) {
      return (await store.get(key, { type: "json", consistency: "strong" })) ?? null;
    },
    async getWithMetadata(key) {
      const found = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
      if (!found) return null;
      return { data: found.data, etag: found.etag || "" };
    },
    async setJSON(key, value, options) {
      const write = options?.onlyIfMatch ? { onlyIfMatch: options.onlyIfMatch } : options?.onlyIfNew ? { onlyIfNew: true } : {};
      const result = await store.setJSON(key, value, write);
      return { modified: result.modified, etag: result.etag };
    },
    async delete(key) {
      await store.delete(key);
    },
    async list(options) {
      const result = await store.list({ prefix: options?.prefix });
      return { blobs: result.blobs.map((blob) => ({ key: blob.key })) };
    },
  };
}

export function openJsonStore(logicalName: string, options?: { strong?: boolean }): JsonStore {
  const plan = planBlobStore(logicalName);
  if (plan.kind === "memory") return memoryJsonStore(plan.name);
  if (plan.kind === "local") return memoryJsonStore(`${logicalName}--local`);
  if (plan.kind === "deploy") return wrapNetlifyStore(getDeployStore(plan.name) as unknown as NetlifyStore);
  const site = options?.strong ? getStore(plan.name, { consistency: "strong" }) : getStore(plan.name);
  return wrapNetlifyStore(site as unknown as NetlifyStore);
}
