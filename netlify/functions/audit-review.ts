import { handleAuditReview } from "../../lib/audit/review-handler";
import { withNetlifyStorage, type NetlifyRuntimeContext } from "../../lib/storage/runtime";

export default async function auditReview(request: Request, context: NetlifyRuntimeContext) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  return withNetlifyStorage(context, () => handleAuditReview(request));
}

export const config = { method: "POST" };
