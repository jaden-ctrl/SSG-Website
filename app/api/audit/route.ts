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

export async function POST(request:Request){
  const caseId=crypto.randomUUID(),accessToken=randomBytes(24).toString("base64url"),started=Date.now();
  try{
    if(Number(request.headers.get("content-length")||0)>30_000)return NextResponse.json({error:"Request is too large.",caseId},{status:413});
    const intake=intakeSchema.parse(await request.json()),now=new Date().toISOString();
    let record:AuditCase={caseId,tenantId:`pretenant:${hash(intake.email.toLowerCase()).slice(0,16)}`,accessTokenHash:hash(accessToken),version:1,state:"PROSPECT_RECEIVED",createdAt:now,updatedAt:now,intake,inputSnapshotHash:hash(JSON.stringify(intake)),consent:{noticeVersion:"free-audit-notice-v1",purpose:"Prepare and review an SSGAI free audit preview and permit relevant follow-up",recordedAt:now},governance:{...SSG_BRAIN_BASELINE,...SSGAI_AGENT_RELEASE}};
    await cases.save(record);record=transition(record,"PROSPECT_RECEIVED","CONSENT_AND_AUTHORITY_RECORDED");await cases.save(record);record=transition(record,"CONSENT_AND_AUTHORITY_RECORDED","INTAKE_VALIDATED");await cases.save(record);record=transition(record,"INTAKE_VALIDATED","AUDIT_CASE_OPENED");await cases.save(record);
    const lead:LeadRecord={...intake,id:caseId,createdAt:now,status:"received"};await captureLead(lead);record=transition(record,"AUDIT_CASE_OPENED","DOMAIN_ANALYSIS");await cases.save(record);
    try{const previewCandidate=await runAtlasFreeAudit(intake,caseId);record=transition(record,"DOMAIN_ANALYSIS","QA_PENDING",{previewCandidate});await cases.save(record);await captureLead({...lead,status:"analyzed",audit:previewCandidate});console.info(JSON.stringify({event:"atlas_audit_candidate_ready",caseId,state:record.state,durationMs:Date.now()-started,agentRelease:SSGAI_AGENT_RELEASE.releaseId,brainCandidate:SSG_BRAIN_BASELINE.candidateId}));return NextResponse.json({caseId,accessToken,status:"pending_review",message:"Your analysis is complete and awaiting SSG review before release."},{status:202})}
    catch(cause){record=transition(record,"DOMAIN_ANALYSIS","FAILED_RECOVERABLE",{failure:{code:"AGENT_ANALYSIS_FAILED",recordedAt:new Date().toISOString()}});await cases.save(record);await captureLead({...lead,status:"analysis_failed"});throw cause}
  }catch(cause){if(cause instanceof ZodError)return NextResponse.json({error:"Please check the form and try again.",fields:cause.flatten().fieldErrors,caseId},{status:400});console.error(JSON.stringify({event:"audit_case_failed",caseId,durationMs:Date.now()-started,message:cause instanceof Error?cause.message:"unknown"}));return NextResponse.json({error:"SSGAI could not complete the analysis. The case is held for safe follow-up.",caseId},{status:500})}
}

