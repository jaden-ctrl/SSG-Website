import { openNetlifyStore } from "../../lib/storage/netlify";
import { storageScope, withNetlifyStorage, type NetlifyRuntimeContext } from "../../lib/storage/runtime";

export default async function auditReadiness(request: Request, context: NetlifyRuntimeContext) {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  return withNetlifyStorage(context, async () => {
    try {
      await openNetlifyStore("ssgai-cases").get("__readiness__", { consistency: "strong" });
      return Response.json({ status: "ready", storage: "netlify-blobs", scope: storageScope(), writesPerformed: false });
    } catch (cause) {
      return Response.json({ status: "unavailable", storage: "netlify-blobs", errorType: cause instanceof Error ? cause.name : "UnknownError", writesPerformed: false }, { status: 503 });
    }
  });
}

export const config = { method: "GET" };
