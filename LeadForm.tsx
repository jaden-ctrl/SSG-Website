'use client';

import { FormEvent, useState } from 'react';

type LeadFormProps = {
  source?: string;
  variant?: 'contact' | 'audit';
};

type FormPayload = Record<string, string>;

export default function LeadForm({ source = 'website-contact', variant = 'contact' }: LeadFormProps) {
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAudit = variant === 'audit';
  const formName = isAudit ? 'ssg-free-audit' : 'ssg-contact';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    const form = e.currentTarget;
    const params = new URLSearchParams(window.location.search);
    const data = Object.fromEntries(
      Array.from(new FormData(form).entries(), ([key, value]) => [key, String(value)]),
    ) as FormPayload;
    const payload: FormPayload = {
      ...data,
      source,
      form_variant: variant,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      landing_page: window.location.href,
    };

    setIsSubmitting(true);
    setStatus('Sending…');

    try {
      // Prefer the server route so leads go directly to HubSpot.
      const apiResponse = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!apiResponse.ok) {
        // If HubSpot is unavailable or not configured, retain the lead in Netlify Forms.
        const netlifyBody = new URLSearchParams({
          'form-name': formName,
          ...payload,
        });
        const netlifyResponse = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: netlifyBody.toString(),
        });
        if (!netlifyResponse.ok) throw new Error('Both lead destinations rejected the submission.');
      }

      form.reset();
      setStatus(
        isAudit
          ? 'Audit request received. We’ll review your information and follow up.'
          : 'Thanks — your project inquiry has been received.',
      );
    } catch (error) {
      console.error('Lead form submission failed:', error);
      setStatus('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const formProps = {
    className: 'form',
    name: formName,
    method: 'POST' as const,
    action: '/',
    'data-netlify': 'true',
    'netlify-honeypot': 'bot-field',
    onSubmit: submit,
  };

  if (isAudit) {
    return (
      <form {...formProps}>
        <input type="hidden" name="form-name" value={formName} />
        <p hidden><label>Do not fill this out: <input name="bot-field" /></label></p>
        <div className="form-row">
          <label>First name<input name="first_name" required autoComplete="given-name" /></label>
          <label>Last name<input name="last_name" required autoComplete="family-name" /></label>
        </div>
        <div className="form-row">
          <label>Email<input name="email" required type="email" autoComplete="email" /></label>
          <label>Phone<input name="phone" type="tel" autoComplete="tel" /></label>
        </div>
        <label>Company<input name="company" required /></label>
        <label>Website or primary online presence<input name="website" placeholder="https://" required /></label>
        <div className="form-row">
          <label>Primary growth concern
            <select name="growth_concern" defaultValue="" required>
              <option value="" disabled>Select one</option>
              <option>Website is not converting</option>
              <option>Not enough qualified leads</option>
              <option>Follow-up is inconsistent</option>
              <option>CRM / pipeline is disorganized</option>
              <option>Too much manual work</option>
              <option>Need stronger local visibility</option>
              <option>Not sure — need diagnosis</option>
            </select>
          </label>
          <label>Approximate monthly lead volume
            <select name="monthly_leads" defaultValue="">
              <option value="" disabled>Select range</option>
              <option>0–10</option><option>11–30</option><option>31–100</option><option>100+</option><option>Not sure</option>
            </select>
          </label>
        </div>
        <label>Where do leads currently go after they contact you?
          <input name="lead_flow" placeholder="Example: email inbox, spreadsheet, HubSpot, phone only" />
        </label>
        <label>What feels like the biggest leak right now?<textarea name="message" required /></label>
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Request My Free Audit'}
        </button>
        <div className="form-status" aria-live="polite">{status}</div>
      </form>
    );
  }

  return (
    <form {...formProps}>
      <input type="hidden" name="form-name" value={formName} />
      <p hidden><label>Do not fill this out: <input name="bot-field" /></label></p>
      <div className="form-row">
        <label>First name<input name="first_name" required autoComplete="given-name" /></label>
        <label>Last name<input name="last_name" required autoComplete="family-name" /></label>
      </div>
      <div className="form-row">
        <label>Email<input name="email" required type="email" autoComplete="email" /></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" /></label>
      </div>
      <label>Company<input name="company" required /></label>
      <label>Website<input name="website" placeholder="https://" /></label>
      <div className="form-row">
        <label>What can we help you build?
          <select name="project_type" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option>Website / digital presence</option><option>CRM & sales system</option><option>Workflow automation</option>
            <option>AI implementation</option><option>Lead generation system</option><option>Growth strategy / advisory</option>
            <option>Multiple systems / full engagement</option>
          </select>
        </label>
        <label>Target timeline
          <select name="timeline" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option>ASAP</option><option>Within 30 days</option><option>1–3 months</option><option>3+ months</option><option>Exploring options</option>
          </select>
        </label>
      </div>
      <label>Estimated project investment
        <select name="budget" defaultValue="">
          <option value="" disabled>Select a range</option>
          <option>Under $2,500</option><option>$2,500–$5,000</option><option>$5,000–$10,000</option>
          <option>$10,000–$25,000</option><option>$25,000+</option><option>Not sure yet</option>
        </select>
      </label>
      <label>What outcome are you trying to create?<textarea name="message" required /></label>
      <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Start the Conversation'}
      </button>
      <div className="form-status" aria-live="polite">{status}</div>
    </form>
  );
}
