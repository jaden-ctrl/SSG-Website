import Link from 'next/link';
import { Check, Mail, Search, UserRound } from 'lucide-react';
import AuditForm from '@/components/AuditForm';

export const metadata = {
  title: 'Free Website Review',
  description: 'Get a personal website review from Jaden Shipley. Receive practical suggestions about your message, mobile experience and customer inquiry path by email.',
  alternates: { canonical: '/audit' },
};

export default function Audit() {
  return <main id="main-content"><section className="page-hero audit-page"><div className="container contact-grid">
    <div className="contact-intro"><div className="eyebrow">Free Website Review</div><h1 className="h2 contact-title">A fresh perspective.<br/><span className="blue">Practical next steps.</span></h1><p className="lede">Send us your website and tell us what isn’t working for you. Jaden will personally review it and email you observations and suggested improvements.</p>
      <ul className="check-list review-points">{['Message: can visitors quickly understand what you do?','Mobile experience: is the site easy to read and navigate?','Trust: are your services and business details clear?','Inquiries: can a visitor easily take the next step?'].map(point=><li key={point}><Check size={18}/>{point}</li>)}</ul>
      <div className="conversation-steps"><div><Search size={20}/><span><strong>01 — Share your website</strong><small>Tell us about the part you want to improve.</small></span></div><div><UserRound size={20}/><span><strong>02 — Jaden reviews it</strong><small>A personal review of the pages and customer journey.</small></span></div><div><Mail size={20}/><span><strong>03 — Get feedback by email</strong><small>Practical suggestions to help you decide what to do next.</small></span></div></div>
      <p className="muted review-boundary">This is an initial website review. Detailed technical testing, implementation and ongoing work are scoped separately.</p>
      <p className="muted">Don’t have a website yet? <Link className="text-link" href="/contact">Tell us about your project.</Link></p>
    </div>
    <div className="contact-form-shell"><div className="contact-form-head"><span className="pill">PERSONALLY REVIEWED BY JADEN</span><h2>Request your free review.</h2><p className="muted">Share a few details so the feedback is relevant to your business.</p></div><AuditForm /></div>
  </div></section></main>;
}
