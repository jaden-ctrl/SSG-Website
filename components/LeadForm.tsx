'use client';

import { FormEvent, useRef, useState } from 'react';

type LeadFormProps = { source?: string; variant?: 'project' | 'website_review' };

export default function LeadForm({ source = 'website-quote-request', variant = 'project' }: LeadFormProps) {
  const review = variant === 'website_review';
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [failed, setFailed] = useState(false);
  const submissionId = useRef(crypto.randomUUID());
  const startedAt = useRef(Date.now());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const params = new URLSearchParams(window.location.search);
    setSending(true); setFailed(false); setStatus('Sending your request…');
    try {
      const rawWebsite = String(data.website || '').trim();
      let website = '';
      if (rawWebsite) {
        const url = new URL(/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error('website');
        website = url.href;
      }
      const response = await fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, website, source, form_variant: review ? 'website_review' : 'contact',
          client_submission_id: submissionId.current, form_started_at: startedAt.current,
          utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '', landing_page: window.location.href }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('submission');
      form.reset(); setSucceeded(true);
      submissionId.current = crypto.randomUUID();
      startedAt.current = Date.now();
      setStatus(review ? 'Your website review request has been received. Jaden will review your site and follow up by email.' : 'Your quote request has been received. Jaden will follow up by email to clarify your requirements before preparing the proposal.');
    } catch (cause) {
      setFailed(true);
      setStatus(cause instanceof Error && cause.message === 'website' ? 'Please enter a valid website address, such as yourbusiness.com.' : 'Your request could not be confirmed. Your answers are still here—please try again.');
    } finally { setSending(false); }
  }

  return <div>
    {succeeded ? <div className="submission-success"><span className="pill">REQUEST RECEIVED</span><h3>Thanks for reaching out.</h3><p>{review ? 'Your website review will be completed personally by Jaden. Look out for an email with practical observations and suggested next steps.' : 'Next, Jaden will follow up about your requirements so the proposed scope, pricing and timeline fit your project.'}</p></div> :
    <form className="form" onSubmit={submit} aria-busy={sending}>
      <div className="form-row"><label>First name<input name="first_name" required maxLength={80} autoComplete="given-name" /></label><label>Last name <span className="field-optional">Optional</span><input name="last_name" maxLength={80} autoComplete="family-name" /></label></div>
      <label>Email<input name="email" required type="email" maxLength={200} autoComplete="email" /></label>
      <label>Company or organization<input name="company" required maxLength={160} autoComplete="organization" /></label>
      <label>{review ? 'Website to review' : 'Current website'}{!review && <span className="field-optional">Optional</span>}<input name="website" required={review} type="text" inputMode="url" placeholder="yourbusiness.com" maxLength={500} autoComplete="url" /></label>
      {!review && <div className="form-row"><label>What do you need?<select name="project_type" defaultValue="" required><option value="" disabled>Select a project</option><option>A new website</option><option>A website redesign</option><option>Website + CRM or automation</option><option>CRM, automation or local visibility</option><option>Help deciding where to start</option></select></label><label>Ideal timing <span className="field-optional">Optional</span><select name="timeline" defaultValue=""><option value="">Select timing</option><option value="not_sure">Not sure yet</option><option value="asap">As soon as practical</option><option value="1_3_months">Within 1–3 months</option><option value="3_plus_months">More than 3 months away</option></select></label></div>}
      {!review && <label>Planning budget <span className="field-optional">Optional</span><input name="budget" maxLength={100} placeholder="A range, or leave blank if undecided" /></label>}
      <label>{review ? 'What would you like to improve?' : 'Tell us about your project'}<textarea name="message" required minLength={10} maxLength={3000} placeholder={review ? 'For example: the site looks dated, visitors struggle to find services, or the contact process is confusing.' : 'What should the website achieve? Share the audience, key pages or features, and any team, integration or approval requirements.'} /></label>
      <label className="consent-label"><input name="consent" type="checkbox" value="true" required /><span>You may contact me about this request.</span></label>
      <input name="faxNumber" tabIndex={-1} autoComplete="off" aria-hidden="true" className="honeypot" />
      <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Sending…' : review ? 'Request My Free Website Review' : 'Request My Website Quote'}</button>
      <p className="form-note">{review ? 'Jaden reviews requests personally and follows up by email. No cost or obligation to start a project.' : 'Your request starts the quoting process. We’ll clarify the details before preparing your scope, pricing and proposed timeline.'}</p>
    </form>}
    <div className={`form-status${failed ? ' is-error' : ''}`} role={failed ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">{status}</div>
  </div>;
}
