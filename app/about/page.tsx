import Link from 'next/link';
import { ArrowRight, Compass, Hammer, MessageSquare, Network } from 'lucide-react';

export const metadata = {
  title: 'About & Founder Jaden Shipley',
  description: 'Meet Jaden Shipley, Founder & CEO of Shipley Solutions Group Inc. Practical website design, CRM and automation support for small businesses.',
  alternates: { canonical: 'https://shipleysolutionsgroup.com/about' },
};

const principles = [
  { Icon: Compass, title: 'Understand the business', copy: 'Start with your customers, services and goals before deciding on pages or technology.' },
  { Icon: MessageSquare, title: 'Keep the message clear', copy: 'Explain what you do in language your customers understand, with a useful next step.' },
  { Icon: Hammer, title: 'Define the work', copy: 'Agree on the scope, responsibilities and deliverables so both sides know what comes next.' },
  { Icon: Network, title: 'Connect what matters', copy: 'Bring in CRM and automation when they support the customer journey and your actual operations.' },
];

export default function About() {
  return <main id="main-content">
    <section className="page-hero about-hero"><div className="container"><div className="eyebrow">About Shipley Solutions Group</div><h1 className="display about-display">Business experience.<br/><span className="blue">Practical web design.</span></h1><p className="lede">SSG helps small businesses build a clearer presence online. We start with a website that explains your offer and makes it easier for customers to contact you, then connect the supporting systems when you need them.</p></div></section>
    <section className="section-tight" id="founder" aria-labelledby="founder-heading"><div className="container split founder-section"><div><div className="eyebrow">Meet the founder</div><h2 className="h2" id="founder-heading">Founded by <a className="founder-name" href="https://jadenshipley.com/">Jaden Shipley</a></h2><p className="founder-role">Founder &amp; CEO · Shipley Solutions Group Inc.</p></div><div><p className="lede">Jaden is a self-taught entrepreneur with hands-on experience in web design, coding and running his own businesses, including Shipley’s Detailing.</p><p className="muted">That experience shapes the work: how a service is explained, how an inquiry gets handled and what makes a business easier to choose. SSG brings that practical perspective to website design, CRM and automation.</p><a className="text-link section-link" href="https://jadenshipley.com/">Meet Jaden <ArrowRight size={17}/></a></div></div></section>
    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">How we work</div><h2 className="h2">A straightforward approach<br/>to your next website.</h2></div><p className="lede section-copy">Work directly with Jaden, from the first discussion through design, development and launch.</p></div><div className="grid-2">{principles.map(({Icon,title,copy})=><article className="card approach-card" key={title}><div className="card-icon"><Icon size={21}/></div><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div></div></section>
    <section className="section-tight"><div className="container cta"><div><h2>Let’s talk about your website.</h2><p className="lede cta-copy">Start with the business. Build around what it needs.</p></div><Link href="/contact" className="btn btn-primary">Discuss Your Website <ArrowRight size={18}/></Link></div></section>
  </main>;
}
