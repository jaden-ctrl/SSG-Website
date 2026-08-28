import { getStore } from "@netlify/blobs";

export default async function auditReadiness() {
  try {
    getStore("ssgai-cases");
    return Response.json({ status: "ready", storage: "netlify-blobs", writesPerformed: false });
  } catch (cause) {
    return Response.json({ status: "unavailable", storage: "netlify-blobs", errorType: cause instanceof Error ? cause.name : "UnknownError", writesPerformed: false }, { status: 503 });
  }
}
