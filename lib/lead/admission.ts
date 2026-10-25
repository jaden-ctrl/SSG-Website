import { NextRequest, NextResponse } from "next/server";
import { assertLiveTestPortal, LiveTestBlockedError } from "@/lib/gateway";
import { acceptLead } from "@/lib/lead/intake";
import { alertOps } from "@/lib/lead/ops-alert";
import { currentDecision, currentRequestHost, hostFromHeaders, hostInProductionScope, modeLabel, productionModeMismatch, runWithRequestHost, type ModeDecision } from "@/lib/runtime-mode";

function leadResponse(body: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "X-SSG-Lead-Mode": modeLabel(currentDecision()), ...extra },
  });
}

export function admissionError(buildContext: string, decision: ModeDecision, env: NodeJS.ProcessEnv = process.env): { status: 503; event: string; code: string; reason?: string } | null {
  if (decision.block === "live_test_on_prod_host") {
    return { status: 503, event: "lead_live_test_on_prod_host", code: "lead_live_test_on_prod_host" };
  }
  // Mock or live-test on a production host is a hard failure, whatever the bake.
  if (hostInProductionScope(currentRequestHost(), env) && decision.mode !== "live") {
    const code = decision.mode === "live-test" ? "lead_live_test_on_prod_host" : "lead_mode_mismatch";
    return { status: 503, event: code, code };
  }
  if (productionModeMismatch(buildContext, decision)) return { status: 503, event: "lead_mode_mismatch", code: "lead_mode_mismatch" };
  if (decision.block) return { status: 503, event: "lead_live_test_blocked", code: "lead_live_test_blocked", reason: decision.block };
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
    console.error(JSON.stringify({ event: blocked.event, code: blocked.code, mode: "mock", reason: blocked.reason }));
    await alertOps({ code: blocked.code, decision });
    return leadResponse({ ok: false, code: blocked.code, error: "Lead system is not configured yet." }, blocked.status);
  }
  if (decision.mode === "live-test") {
    try {
      await assertLiveTestPortal(decision);
    } catch (error) {
      if (error instanceof LiveTestBlockedError) {
        console.error(JSON.stringify({ event: "lead_live_test_blocked", code: "lead_live_test_blocked", reason: error.code }));
        await alertOps({ code: "lead_live_test_blocked", decision });
        return leadResponse({ ok: false, code: "lead_live_test_blocked", error: "Lead system is not configured yet." }, 503);
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
      const code = error.code === "production_mismatch" ? "lead_portal_mismatch" : "lead_live_test_blocked";
      console.error(JSON.stringify({ event: code, code, reason: error.code }));
      await alertOps({ code, decision });
      return leadResponse({ ok: false, code, error: "Lead system is not configured yet." }, 503);
    }
    console.error(JSON.stringify({ event: "lead_submission_failed", code: "lead_submission_failed", errorClass: error instanceof Error ? error.name : "unknown" }));
    return leadResponse({ ok: false, code: "lead_submission_failed", error: "Lead submission failed" }, 502);
  }
}
