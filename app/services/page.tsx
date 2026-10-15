import Link from 'next/link';
import { ArrowRight, Check, DatabaseZap, Search, Workflow } from 'lucide-react';
import WebsiteProcess from '@/components/WebsiteProcess';

export const metadata = {
  title: 'Website Design & Supporting Services',
  description: 'New websites and redesigns for businesses and organizations, with optional CRM, automation and local visibility support. Get a project scope tailored to your business.',
  alternates: { canonical: '/services' },
};

export default function Services() {
  return <main id="main-content">
    <section className="page-hero"><div className="container"><div className="eyebrow">Website design &amp; development</div><h1 className="display about-display">A website built<br/><span className="blue">around your business.</span></h1><p className="lede">Launching a business, refreshing an established brand or planning a larger company website? We’ll help you define the message, design the experience and scope the project around your goals.</p><div className="hero-actions"><Link href="/contact" className="btn btn-primary">Discuss Your Website <ArrowRight size={18}/></Link><Link href="/work" className="btn btn-secondary">Explore Our Work</Link></div></div></section>
    <section className="section-tight"><div className="container split website-scope"><div><div className="eyebrow">The core project</div><h2 className="h2">Clear content.<br/>Thoughtful design.<br/>A useful next step.</h2><p className="lede">We define the pages, audiences, content responsibilities, functionality, timeline and price in your proposal. For projects involving multiple teams, we also agree on stakeholders, approvals and launch requirements before work begins.</p><p className="muted">Hosting, ongoing care and any paid tools are discussed as part of the scope.</p></div><div className="card scope-card"><h3>What we plan together</h3><ul className="check-list">{['Page structure and a clear description of your services','Visual design that fits your business and brand','Responsive layouts for mobile, tablet and desktop','Contact forms and clear calls to action','Page titles, descriptions and search foundations','Launch checks, handoff and support requirements'].map(item=><li key={item}><Check size={18}/>{item}</li>)}</ul></div></div></section>
    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">The project process</div><h2 className="h2">Know what happens next.</h2></div></div><WebsiteProcess /></div></section>
    <section className="section work-section" id="supporting-services"><div className="container"><div className="section-head"><div><div className="eyebrow">Supporting services</div><h2 className="h2">Connect the next<br/>part of the journey.</h2></div><p className="lede section-copy">Add these when they solve a specific need. Each is scoped separately, so your website project stays focused.</p></div><div className="grid-3">{[
      { Icon: DatabaseZap, title: 'CRM & lead follow-up', copy: 'Organize inquiries, define pipeline stages and create a consistent process for following up with potential customers.' },
      { Icon: Workflow, title: 'Workflow automation', copy: 'Connect forms and business tools, route information and reduce repetitive administrative work.' },
      { Icon: Search, title: 'Local visibility & lead generation', copy: 'Review local search foundations, service messaging and landing pages, then scope the work around your audience.' },
    ].map(({Icon,title,copy})=><article className="card" key={title}><div className="card-icon"><Icon size={22}/></div><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <section className="section"><div className="container faq-layout"><div><div className="eyebrow">Before we start</div><h2 className="h2">A few practical answers.</h2></div><div className="faq-list">
      <details><summary>How much does a website cost?</summary><p>Pricing depends on the number of pages, content, features and integrations. Share your requirements and we’ll define a scope and quote before work starts.</p></details>
      <details><summary>Can you redesign an existing website?</summary><p>Yes. We’ll review what you have, what needs to change and whether to improve the existing site or rebuild it. Existing pages and search visibility are part of that discussion.</p></details>
      <details><summary>How long will the project take?</summary><p>We agree on a timeline after defining the scope. Content readiness, feedback and integrations all affect the schedule.</p></details>
      <details><summary>Do I need a CRM or automation package?</summary><p>You can start with a website project. Supporting services are added only when they fit the agreed scope and your business needs.</p></details>
      <details><summary>Can you review my current website first?</summary><p>Yes. <Link href="/audit">Request a Free Website Review</Link>. Jaden personally reviews the site and follows up by email with practical suggestions.</p></details>
    </div></div></section>
    <section className="section-tight"><div className="container cta"><div><h2>Have a website project in mind?</h2><p className="lede cta-copy">Tell us about your business and the change you want to make.</p></div><Link className="btn btn-primary" href="/contact">Discuss Your Website <ArrowRight size={18}/></Link></div></section>
  </main>;
}
