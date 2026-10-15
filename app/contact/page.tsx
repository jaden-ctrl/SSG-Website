import Link from 'next/link';
import { ArrowRight, ClipboardList, MessageSquareText, PencilRuler } from 'lucide-react';
import LeadForm from '@/components/LeadForm';

export const metadata = {
  title: 'Discuss Your Website',
  description: 'Start a website project with Shipley Solutions Group. Tell Jaden about your business, goals and timeline to discuss the right scope.',
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return <main id="main-content"><section className="page-hero contact-page"><div className="container contact-grid">
    <div className="contact-intro"><div className="eyebrow">Discuss your website</div><h1 className="h2 contact-title">Let’s put your business<br/><span className="blue">in a better light.</span></h1><p className="lede">Whether you’re a business owner or part of a company team, tell us about your organization and what the website needs to achieve. Jaden will follow up to discuss scope, requirements and the next step.</p>
      <div className="conversation-steps"><div><MessageSquareText size={20}/><span><strong>Tell us about your business</strong><small>A new site, a redesign or a specific problem to solve.</small></span></div><div><PencilRuler size={20}/><span><strong>Talk through the project</strong><small>Audiences, pages, features, integrations and team requirements.</small></span></div><div><ClipboardList size={20}/><span><strong>Get a defined scope</strong><small>Agree on the work, price and timing before the build starts.</small></span></div></div>
      <div className="contact-callout"><span className="eyebrow">Want feedback first?</span><p>Get a personal review of your current website before deciding on a project.</p><Link href="/audit">Request a Free Website Review <ArrowRight size={16}/></Link></div>
    </div>
    <div className="contact-form-shell"><div className="contact-form-head"><span className="pill">WEBSITE PROJECT INQUIRY</span><h2>What are you looking to build?</h2><p className="muted">A little context helps us start the right conversation.</p></div><LeadForm /></div>
  </div></section></main>;
}
