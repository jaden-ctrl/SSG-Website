import { getDeployStore, getStore } from "@netlify/blobs";
import { storageScope } from "./runtime";

export function openNetlifyStore(name: string) {
  return storageScope() === "deploy"
    ? getDeployStore(name)
    : getStore({ name, consistency: "strong" });
}
