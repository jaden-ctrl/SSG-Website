import { handleAuditSubmit } from "../../lib/audit/submit-handler";

export default async function auditSubmit(request: Request) {
  return handleAuditSubmit(request);
}
