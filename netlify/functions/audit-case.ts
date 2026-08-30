import { handleAuditCase } from "../../lib/audit/case-handler";
import { withNetlifyStorage, type NetlifyRuntimeContext } from "../../lib/storage/runtime";

export default async function auditCase(request: Request, context: NetlifyRuntimeContext) {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const caseId = new URL(request.url).searchParams.get("caseId") || "";
  return withNetlifyStorage(context, () => handleAuditCase(request, caseId));
}

export const config = { method: "GET" };
