'use client';

import { FormEvent, useState } from 'react';

type LeadFormProps = {
  source?: string;
  variant?: 'contact' | 'audit';
};

export default function LeadForm({ source = 'website-contact', variant = 'contact' }: LeadFormProps) {
  const [status, setStatus] = useState('');
  const isAudit = variant === 'audit';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Sending…');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const params = new URLSearchParams(window.location.search);
    const payload = {
      ...data,
      source,
      form_variant: variant,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      landing_page: window.location.href,
    };

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Request failed');
      form.reset();
      setStatus(
        isAudit
          ? 'Audit request received. We’ll review your information and follow up.'
          : 'Thanks — your project inquiry has been received.'
      );
    } catch {
      setStatus('Something went wrong. Please try again.');
    }
  }

  if (isAudit) {
    return (
      <form className="form" onSubmit={submit}>
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
              <option>0–10</option>
              <option>11–30</option>
              <option>31–100</option>
              <option>100+</option>
              <option>Not sure</option>
            </select>
          </label>
        </div>
        <label>Where do leads currently go after they contact you?
          <input name="lead_flow" placeholder="Example: email inbox, spreadsheet, HubSpot, phone only" />
        </label>
        <label>What feels like the biggest leak right now?<textarea name="message" required /></label>
        <button className="btn btn-primary" type="submit">Request My Free Audit</button>
        <div className="form-status" aria-live="polite">{status}</div>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
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
            <option>Website / digital presence</option>
            <option>CRM & sales system</option>
            <option>Workflow automation</option>
            <option>AI implementation</option>
            <option>Lead generation system</option>
            <option>Growth strategy / advisory</option>
            <option>Multiple systems / full engagement</option>
          </select>
        </label>
        <label>Target timeline
          <select name="timeline" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option>ASAP</option>
            <option>Within 30 days</option>
            <option>1–3 months</option>
            <option>3+ months</option>
            <option>Exploring options</option>
          </select>
        </label>
      </div>
      <label>Estimated project investment
        <select name="budget" defaultValue="">
          <option value="" disabled>Select a range</option>
          <option>Under $2,500</option>
          <option>$2,500–$5,000</option>
          <option>$5,000–$10,000</option>
          <option>$10,000–$25,000</option>
          <option>$25,000+</option>
          <option>Not sure yet</option>
        </select>
      </label>
      <label>What outcome are you trying to create?<textarea name="message" required /></label>
      <button className="btn btn-primary" type="submit">Start the Conversation</button>
      <div className="form-status" aria-live="polite">{status}</div>
    </form>
  );
}
