import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runAtlasFreeAudit } from "@/lib/atlas/free-audit";
import { captureLead, type LeadRecord } from "@/lib/actions/leads";
import { cases, transition, type AuditCase } from "@/lib/cases/repository";
import { SSGAI_AGENT_RELEASE, SSG_BRAIN_BASELINE } from "@/lib/governance/manifest";
import { intakeSchema } from "@/lib/schemas";

export const runtime="nodejs"; export const maxDuration=60;
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const failureCode=(cause:unknown)=>{const name=cause instanceof Error?cause.name:"",message=cause instanceof Error?cause.message.toLowerCase():"";if(name.includes("MaxTurns"))return"MODEL_MAX_TURNS";if(name.includes("ModelBehavior"))return"MODEL_OUTPUT_INVALID";if(name.includes("ModelRefusal"))return"MODEL_REFUSED";if(name.includes("Timeout")||message.includes("timeout")||message.includes("timed out"))return"MODEL_TIMEOUT";if(message.includes("schema")||message.includes("response_format")||message.includes("structured output"))return"MODEL_SCHEMA_INVALID";if(message.includes("api key")||message.includes("401")||message.includes("authentication"))return"MODEL_AUTH_FAILED";if(message.includes("insufficient_quota")||message.includes("quota")||message.includes("billing"))return"MODEL_QUOTA_EXHAUSTED";if(message.includes("429")||message.includes("rate limit"))return"MODEL_RATE_LIMITED";if(message.includes("model"))return"MODEL_UNAVAILABLE";if(message.includes("blob")||message.includes("store"))return"STORAGE_FAILED";return"ANALYSIS_FAILED"};
const safeDiagnostic=(cause:unknown)=>{if(process.env.CONTEXT!=="deploy-preview"||!(cause instanceof Error))return undefined;return{type:cause.name||"Error",message:cause.message.replace(/sk-[A-Za-z0-9_-]+/g,"[redacted-key]").replace(/Bearer\s+\S+/gi,"Bearer [redacted]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[redacted-email]").slice(0,240)}};

export async function POST(request:Request){
  const caseId=crypto.randomUUID(),accessToken=randomBytes(24).toString("base64url"),started=Date.now();let stage="REQUEST_VALIDATION";
  try{
    if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"The Free Audit service is not configured for this deploy preview. No submission was saved.",caseId},{status:503});
    if(Number(request.headers.get("content-length")||0)>30_000)return NextResponse.json({error:"Request is too large.",caseId},{status:413});
    const intake=intakeSchema.parse(await request.json()),now=new Date().toISOString();
    let record:AuditCase={caseId,tenantId:`pretenant:${hash(intake.email.toLowerCase()).slice(0,16)}`,accessTokenHash:hash(accessToken),version:1,state:"PROSPECT_RECEIVED",createdAt:now,updatedAt:now,intake,inputSnapshotHash:hash(JSON.stringify(intake)),consent:{noticeVersion:"free-audit-notice-v1",purpose:"Prepare and review an SSGAI free audit preview and permit relevant follow-up",recordedAt:now},governance:{...SSG_BRAIN_BASELINE,...SSGAI_AGENT_RELEASE}};
    stage="CASE_STORAGE";
    await cases.save(record);record=transition(record,"PROSPECT_RECEIVED","CONSENT_AND_AUTHORITY_RECORDED");await cases.save(record);record=transition(record,"CONSENT_AND_AUTHORITY_RECORDED","INTAKE_VALIDATED");await cases.save(record);record=transition(record,"INTAKE_VALIDATED","AUDIT_CASE_OPENED");await cases.save(record);
    const lead:LeadRecord={...intake,id:caseId,createdAt:now,status:"received"};stage="LEAD_CAPTURE";await captureLead(lead);record=transition(record,"AUDIT_CASE_OPENED","DOMAIN_ANALYSIS");stage="CASE_STORAGE";await cases.save(record);
    try{stage="ATLAS_ANALYSIS";const previewCandidate=await runAtlasFreeAudit(intake,caseId);record=transition(record,"DOMAIN_ANALYSIS","QA_PENDING",{previewCandidate});stage="REVIEW_QUEUE_STORAGE";await cases.save(record);stage="LEAD_UPDATE";await captureLead({...lead,status:"analyzed",audit:previewCandidate});console.info(JSON.stringify({event:"atlas_audit_candidate_ready",caseId,state:record.state,durationMs:Date.now()-started,agentRelease:SSGAI_AGENT_RELEASE.releaseId,brainCandidate:SSG_BRAIN_BASELINE.candidateId}));return NextResponse.json({caseId,accessToken,status:"pending_review",message:"Your analysis is complete and awaiting SSG review before release."},{status:202})}
    catch(cause){const originalStage=stage;record=transition(record,"DOMAIN_ANALYSIS","FAILED_RECOVERABLE",{failure:{code:"AGENT_ANALYSIS_FAILED",recordedAt:new Date().toISOString()}});const cleanup=await Promise.allSettled([cases.save(record),captureLead({...lead,status:"analysis_failed"})]);cleanup.forEach((result,index)=>{if(result.status==="rejected")console.error(JSON.stringify({event:"audit_failure_cleanup_failed",caseId,operation:index===0?"case":"lead",message:result.reason instanceof Error?result.reason.message:"unknown"}))});stage=originalStage;throw cause}
  }catch(cause){if(cause instanceof ZodError)return NextResponse.json({error:"Please check the form and try again.",fields:cause.flatten().fieldErrors,caseId},{status:400});const code=`${stage}_${failureCode(cause)}`,diagnostic=safeDiagnostic(cause);console.error(JSON.stringify({event:"audit_case_failed",caseId,durationMs:Date.now()-started,stage,code,message:cause instanceof Error?cause.message:"unknown"}));return NextResponse.json({error:"SSGAI could not complete the analysis. The case is held for safe follow-up.",code,caseId,...(diagnostic?{diagnostic}:{})},{status:500})}
}

