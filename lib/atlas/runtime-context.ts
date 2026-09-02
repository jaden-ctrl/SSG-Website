import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type AtlasRuntimeContext = {
  caseId: string;
  runId: string;
  correlationId: string;
  requestedBy: string;
};

const storage = new AsyncLocalStorage<AtlasRuntimeContext>();

export function withAtlasRuntimeContext<T>(context: AtlasRuntimeContext, fn: () => Promise<T>) {
  return storage.run(context, fn);
}

export function getAtlasRuntimeContext() {
  return storage.getStore() ?? null;
}
