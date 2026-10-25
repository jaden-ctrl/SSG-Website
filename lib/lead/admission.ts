import { NextRequest, NextResponse } from "next/server";
import { assertLiveTestPortal, LiveTestBlockedError } from "@/lib/gateway";
import { acceptLead } from "@/lib/lead/intake";
import { currentDecision, hostFromHeaders, modeLabel, productionModeMismatch, runWithRequestHost, type ModeDecision } from "@/lib/runtime-mode";

function leadResponse(body: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "X-SSG-Lead-Mode": modeLabel(currentDecision()), ...extra },
  });
}

export function admissionError(buildContext: string, decision: ModeDecision): { status: 503; event: "lead_mode_mismatch" | "lead_live_test_blocked"; reason?: string } | null {
  if (productionModeMismatch(buildContext, decision)) return { status: 503, event: "lead_mode_mismatch" };
  if (decision.block) return { status: 503, event: "lead_live_test_blocked", reason: decision.block };
  return null;
}

export async function handleLeadAdmission(req: NextRequest, buildContext: string) {
  return runWithRequestHost(hostFromHeaders(req.headers), () => handleLeadPost(req, buildContext));
}

async function handleLeadPost(req: NextRequest, buildContext: string) {
  const decision = currentDecision();
  console.info(JSON.stringify({ event: "lead_runtime_mode", mode: decision.block ? "blocked" : decision.mode }));
  const blocked = admissionError(buildContext, decision);
  if (blocked) {
    console.error(JSON.stringify({ event: blocked.event, mode: "mock", reason: blocked.reason }));
    return leadResponse({ ok: false, error: "Lead system is not configured yet." }, blocked.status);
  }
  if (decision.mode === "live-test") {
    try {
      await assertLiveTestPortal(decision);
    } catch (error) {
      if (error instanceof LiveTestBlockedError) {
        console.error(JSON.stringify({ event: "lead_live_test_blocked", reason: error.code }));
        return leadResponse({ ok: false, error: "Lead system is not configured yet." }, 503);
      }
      throw error;
    }
  }

  try {
    const result = await acceptLead(await req.text(), req.headers.get("content-length"), req.headers);
    const extra = result.retryAfter ? { "Retry-After": String(result.retryAfter) } : undefined;
    return leadResponse(result.body, result.status, extra);
  } catch (error) {
    if (error instanceof LiveTestBlockedError) {
      console.error(JSON.stringify({ event: "lead_live_test_blocked", reason: error.code }));
      return leadResponse({ ok: false, error: "Lead system is not configured yet." }, 503);
    }
    console.error("Lead submission error:", error instanceof Error ? error.name : "unknown");
    return leadResponse({ ok: false, error: "Lead submission failed" }, 502);
  }
}
