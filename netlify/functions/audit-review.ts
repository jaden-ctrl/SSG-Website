import { handleAuditReview } from "../../lib/audit/review-handler";

export default async function auditReview(request: Request) {
  return handleAuditReview(request);
}
