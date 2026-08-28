import { handleAuditCase } from "../../lib/audit/case-handler";

export default async function auditCase(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId") || "";
  return handleAuditCase(request, caseId);
}
