import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Bot, CalendarDays, Calculator,
  Check, ClipboardCheck, Layers3, Rocket, Target, Workflow
} from 'lucide-react';
import './products.css';

export const metadata: Metadata = {
  title: 'Products | Digital Business Tools',
  description: 'Explore upcoming digital products from Shipley Solutions Group: practical templates, spreadsheets and playbooks for small-business sales, pricing, marketing and operations.',
  alternates: { canonical: '/products' },
  openGraph: {
    title: 'Digital Business Products | Shipley Solutions Group',
    description: 'Practical tools for building, organizing and growing a business. Explore the upcoming SSG digital product collection.',
    url: '/products',
    type: 'website',
  },
};

const products = [
  {
    number: '01',
    category: 'SALES & GROWTH',
    title: 'Client Acquisition & Sales Toolkit',
    description: 'Build a repeatable process for finding prospects, starting conversations and following up with potential clients.',
    includes: ['Outreach scripts', 'Pipeline tracker', 'Follow-up templates'],
    Icon: Target,
    priority: true,
  },
  {
    number: '02',
    category: 'FINANCE & PRICING',
    title: 'Business Profit & Pricing Calculator',
    description: 'Understand your costs, price your services with more confidence and keep a clearer view of your margins.',
    includes: ['Pricing worksheets', 'Break-even planning', 'Profit targets'],
    Icon: Calculator,
    priority: true,
  },
  {
    number: '03',
    category: 'STARTUP PLANNING',
    title: 'Small Business Launch Kit',
    description: 'Organize your business idea, startup expenses and early priorities into a practical launch plan.',
    includes: ['Launch checklist', 'Startup budget', '90-day action plan'],
    Icon: Rocket,
    priority: true,
  },
  {
    number: '04',
    category: 'MARKETING',
    title: '90-Day Marketing Content Engine',
    description: 'Plan consistent content and campaigns without starting from a blank page every week.',
    includes: ['Content calendar', 'Campaign templates', 'Writing prompts'],
    Icon: CalendarDays,
    priority: false,
  },
  {
    number: '05',
    category: 'CLIENT OPERATIONS',
    title: 'Client Onboarding & Retention System',
    description: 'Create a more consistent experience from a new client inquiry through project handoff and follow-up.',
    includes: ['Intake templates', 'Onboarding checklists', 'Retention workflows'],
    Icon: ClipboardCheck,
    priority: false,
  },
  {
    number: '06',
    category: 'AI & AUTOMATION',
    title: 'AI Business Automation Playbook',
    description: 'Explore practical ways to use AI and connected tools to reduce repetitive business tasks.',
    includes: ['Prompt templates', 'Workflow blueprints', 'Implementation guides'],
    Icon: Bot,
    priority: false,
  },
] as const;

export default function ProductsPage() {
  return (
    <main id="main-content" className="products-page">
      <section className="products-hero">
        <div className="container products-hero-grid">
          <div className="products-hero-copy">
            <div className="eyebrow">SSG DIGITAL PRODUCTS</div>
            <h1 className="display products-display">Better tools.<br /><span className="blue">Stronger business.</span></h1>
            <p className="lede">Practical digital resources for business owners who want to spend less time figuring things out and more time moving forward.</p>
            <div className="products-hero-actions">
              <a className="btn btn-primary" href="#product-catalog">Explore the Collection <ArrowRight size={18} /></a>
              <Link className="btn btn-secondary" href="/services">Explore Our Services</Link>
            </div>
            <p className="products-release-note"><span className="products-pulse" aria-hidden="true" /> Storefront preview · Products are in development</p>
          </div>
          <div className="products-preview" aria-label="Preview of the SSG digital business resources collection">
            <div className="products-preview-top">
              <span>SSG <b>/</b> RESOURCES</span>
              <span>THE DIGITAL COLLECTION</span>
            </div>
            <div className="products-preview-body">
              <div className="products-preview-kicker">BUILD YOUR NEXT MOVE</div>
              <h2>Tools for the<br /><em>work behind growth.</em></h2>
              <p>Practical resources, organized around the parts of business that matter.</p>
              <div className="products-preview-tiles">
                <div><Target size={24} /><span>WIN CLIENTS</span></div>
                <div><Calculator size={24} /><span>PRICE SMARTER</span></div>
                <div><Workflow size={24} /><span>RUN BETTER</span></div>
              </div>
            </div>
            <div className="products-preview-bottom"><span><Layers3 size={15} /> SIX RESOURCES PLANNED</span><span>SSG / 001—006</span></div>
          </div>
        </div>
      </section>

      <section className="products-status-bar" aria-label="Storefront launch status">
        <div className="container">
          <div className="products-status-copy"><span className="products-status-dot" aria-hidden="true" /><strong>The collection is being built.</strong> Preview the planned products below. Purchasing and automatic downloads are not available yet.</div>
        </div>
      </section>

      <section className="section products-catalog-section" id="product-catalog">
        <div className="container">
          <div className="section-head products-section-heading">
            <div><div className="eyebrow">THE COLLECTION</div><h2 className="h2">Made for the way<br />small businesses work.</h2></div>
            <p className="lede section-copy">From your first customers to your day-to-day systems, each resource is being developed to solve a specific business challenge.</p>
          </div>
          <div className="products-grid">
            {products.map(({ number, category, title, description, includes, Icon, priority }) => (
              <article className={'products-card' + (priority ? ' products-card-priority' : '')} key={number}>
                <div className="products-card-top">
                  <span className="products-card-index">{number} / 06</span>
                  <span className="products-card-status">COMING SOON</span>
                </div>
                <div className="products-card-symbol" aria-hidden="true"><Icon size={30} strokeWidth={1.65} /></div>
                <div className="products-card-category">{category}</div>
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="products-card-divider" />
                <div className="products-card-includes-label">PLANNED CONTENT</div>
                <ul>{includes.map((feature) => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
              </article>
            ))}
          </div>
          <p className="products-catalog-disclaimer">This is an advance look at the product roadmap. Final contents, pricing, release dates and availability will be confirmed when each product launches.</p>
        </div>
      </section>

      <section className="section-tight products-value-section">
        <div className="container products-value-grid">
          <div><div className="eyebrow">THE SSG APPROACH</div><h2 className="h2">Useful by design.<br />Not just more reading.</h2><p className="lede">The goal is straightforward: tools you can adapt and put to work in your business, not generic advice that gathers dust.</p></div>
          <div className="products-value-points">
            <div><span>01</span><div><h3>Focused on real tasks</h3><p>Plan, price, market, sell and follow up with more structure.</p></div></div>
            <div><span>02</span><div><h3>Built for independent teams</h3><p>Designed with founders, local businesses and small teams in mind.</p></div></div>
            <div><span>03</span><div><h3>Separate from Business OS</h3><p>Downloadable resources will be distinct from our upcoming software platform.</p></div></div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container products-bottom-cta">
          <div><div className="eyebrow">NEED A HANDS-ON SOLUTION?</div><h2>Digital tools are one part<br />of what SSG does.</h2><p>We also help companies build websites and scope the systems that support their customer journey.</p></div>
          <Link className="btn btn-primary" href="/services">Explore Services <ArrowUpRight size={18} /></Link>
        </div>
      </section>
    </main>
  );
}
