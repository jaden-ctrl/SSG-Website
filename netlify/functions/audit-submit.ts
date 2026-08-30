import { handleAuditSubmit } from "../../lib/audit/submit-handler";
import { withNetlifyStorage, type NetlifyRuntimeContext } from "../../lib/storage/runtime";

export default async function auditSubmit(request: Request, context: NetlifyRuntimeContext) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  return withNetlifyStorage(context, () => handleAuditSubmit(request));
}

export const config = { method: "POST" };
