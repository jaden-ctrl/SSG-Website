'use client';

import { FormEvent, useState } from 'react';
import type { PartialAudit } from '@/lib/schemas';

type PendingCase = { caseId: string; accessToken: string; message: string };

const fieldLabels: Record<string, string> = {
  firstName: 'First name', lastName: 'Last name', email: 'Work email', company: 'Company',
  website: 'Website', teamSize: 'Team size', offer: 'What the business sells',
  challenge: 'Biggest challenge', goal: '12-month goal', revenueRange: 'Annual revenue',
  consent: 'Audit consent',
};

function responseError(data: { error?: string; code?: string; fields?: Record<string, string[] | undefined> }) {
  const invalid = Object.entries(data.fields || {}).filter(([, messages]) => messages?.length);
  if (!invalid.length) return `${data.error || 'We could not complete the audit.'}${data.code ? ` Reference: ${data.code}.` : ''}`;
  return invalid.map(([field, messages]) => `${fieldLabels[field] || field}: ${messages?.[0]}`).join(' ');
}

function normalizeWebsite(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function AuditForm() {
  const [audit, setAudit] = useState<PartialAudit | null>(null);
  const [pending, setPending] = useState<PendingCase | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(''); setAudit(null);
    try {
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData);
      payload.website = normalizeWebsite(formData.get('website'));
      const response = await fetch('/api/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(responseError(data));
      if (response.status === 202) setPending(data);
      else setAudit(data.audit);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unexpected error.'); }
    finally { setLoading(false); }
  }

  if (pending) return <PendingReview pending={pending} onReleased={(value) => { setAudit(value); setPending(null); }} />;
  if (audit) return <AuditResults audit={audit} />;

  return <form className="form" onSubmit={submit}>
    <div className="form-row">
      <label>First name<input name="firstName" required maxLength={80} autoComplete="given-name" /></label>
      <label>Last name<input name="lastName" required maxLength={80} autoComplete="family-name" /></label>
    </div>
    <div className="form-row">
      <label>Work email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <label>Company<input name="company" required maxLength={160} autoComplete="organization" /></label>
    </div>
    <div className="form-row">
      <label>Website<input name="website" type="text" inputMode="url" placeholder="example.com" maxLength={300} /></label>
      <label>Team size<select name="teamSize" required defaultValue=""><option value="" disabled>Select</option><option>1</option><option>2-10</option><option>11-50</option><option>51-200</option><option>201+</option></select></label>
    </div>
    <label>What does the business sell?<textarea name="offer" required minLength={10} maxLength={1200} /></label>
    <label>What is the biggest growth or operational challenge?<textarea name="challenge" required minLength={10} maxLength={1600} /></label>
    <label>What have you already tried?<textarea name="attempts" maxLength={1200} /></label>
    <label>Primary goal for the next 12 months<textarea name="goal" required minLength={10} maxLength={1200} /></label>
    <label>Approximate annual revenue<select name="revenueRange" required defaultValue=""><option value="" disabled>Select</option><option>Pre-revenue</option><option>Under $250K</option><option>$250K-$1M</option><option>$1M-$5M</option><option>$5M-$20M</option><option>$20M+</option><option>Prefer not to say</option></select></label>
    <label><span><input name="consent" type="checkbox" value="true" required style={{ width: 'auto', marginRight: 8 }} />I agree to the audit notice and to be contacted about this request.</span></label>
    <input name="faxNumber" tabIndex={-1} autoComplete="off" aria-hidden="true" className="honeypot" />
    <button className="btn btn-primary" disabled={loading}>{loading ? 'SSGAI is analyzing…' : 'Run my free audit'}</button>
    <p className="muted">SSGAI drafts the preview from your submitted information. An SSG reviewer must approve it before release.</p>
    {error && <div className="form-status" role="alert">{error}</div>}
  </form>;
}

function PendingReview({ pending, onReleased }: { pending: PendingCase; onReleased: (audit: PartialAudit) => void }) {
  const [message, setMessage] = useState(pending.message); const [checking, setChecking] = useState(false);
  async function check() { setChecking(true); try { const response = await fetch(`/api/audit/${pending.caseId}`, { headers: { authorization: `Bearer ${pending.accessToken}` } }); const data = await response.json(); if (data.status === 'released') onReleased(data.audit); else setMessage(data.message || 'Still awaiting review.'); } finally { setChecking(false); } }
  return <div className="audit-results"><div className="eyebrow">Case received</div><h2>Your preview is awaiting SSG review.</h2><p>{message}</p><p className="audit-case-note">Case reference: {pending.caseId}. Independent review is required before release.</p><button className="btn btn-primary" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check review status'}</button></div>;
}

function AuditResults({ audit }: { audit: PartialAudit }) {
  return <div className="audit-results"><div className="eyebrow">Your approved SSGAI preview</div><div className="audit-score"><strong>{audit.overallScore}</strong><span>/ 100 readiness</span></div><h2>{audit.executiveSummary}</h2>{audit.findings.map((item) => <article className="audit-finding" key={item.dimension}><span className="pill">{item.dimension} · {item.score}/100</span><h3>{item.title}</h3><p>{item.observation}</p><p><strong>Next move:</strong> {item.recommendation}</p></article>)}<h3>30-day priority</h3><p>{audit.thirtyDayPriority}</p><p className="muted">Confidence: {audit.confidence}. Evidence gaps: {audit.evidenceGaps.join('; ')}</p><a className="btn btn-primary" href={process.env.NEXT_PUBLIC_FULL_AUDIT_URL || '/contact'}>Get the full SSG audit</a></div>;
}
