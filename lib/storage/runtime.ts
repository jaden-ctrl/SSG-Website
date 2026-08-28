import { AsyncLocalStorage } from "node:async_hooks";

export type NetlifyRuntimeContext = { deploy?: { context?: string } };
export type StorageScope = "site" | "deploy";

type StorageRuntime = { backend: "netlify"; scope: StorageScope };

const storageRuntime = new AsyncLocalStorage<StorageRuntime>();

export function withNetlifyStorage<T>(context: NetlifyRuntimeContext | undefined, operation: () => T): T {
  const scope: StorageScope = context?.deploy?.context === "production" ? "site" : "deploy";
  return storageRuntime.run({ backend: "netlify", scope }, operation);
}

export function storageBackend(): "local" | "netlify" {
  const explicit = process.env.SSGAI_STORAGE_BACKEND;
  if (storageRuntime.getStore()?.backend === "netlify" || explicit === "netlify") return "netlify";
  if (explicit !== "local" && process.env.NETLIFY === "true") return "netlify";
  return "local";
}

export function storageScope(): StorageScope {
  return storageRuntime.getStore()?.scope || "deploy";
}
