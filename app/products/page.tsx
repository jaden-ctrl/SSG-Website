import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Bot, CalendarDays, Calculator,
  Check, ClipboardCheck, Layers3, Rocket, Target, Workflow
} from 'lucide-react';
import ProductInterestForm from '@/components/ProductInterestForm';
import './products.css';

export const metadata: Metadata = {
  title: 'Digital Products & Business Tools',
  description: 'Explore SSG digital products in development, including sales templates, pricing spreadsheets and startup planners. Register your interest in upcoming releases.',
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


const productDetails: Record<string, { audience: string; format: string }> = {
 'Client Acquisition & Sales Toolkit': { audience: 'Service businesses, consultants and B2B sellers', format: 'Editable scripts and sales tracker' },
 'Business Profit & Pricing Calculator': { audience: 'Owners pricing services or reviewing margins', format: 'Interactive spreadsheet workbook' },
 'Small Business Launch Kit': { audience: 'First-time founders and new businesses', format: 'Planning workbook and checklists' },
 '90-Day Marketing Content Engine': { audience: 'Owners managing their own marketing', format: 'Calendar and editable templates' },
 'Client Onboarding & Retention System': { audience: 'Service providers managing client workflows', format: 'Editable forms and workflow checklists' },
 'AI Business Automation Playbook': { audience: 'Small teams exploring AI-assisted operations', format: 'Prompt library and practical guides' },
};

export default function ProductsPage() {
  return (
    <main id="main-content" className="products-page">
      <section className="products-hero">
        <div className="container products-hero-grid">
          <div className="products-hero-copy">
            <div className="eyebrow">SSG DIGITAL PRODUCTS</div>
            <h1 className="display products-display">Less guesswork.<br /><span className="blue">More progress.</span></h1>
            <p className="lede">Digital tools being built to help small businesses win clients, price their work, organize operations and make confident decisions.</p>
            <div className="products-hero-actions">
              <a className="btn btn-primary" href="#product-catalog">Explore Products <ArrowRight size={18} /></a>
              <a className="btn btn-secondary" href="#launch-list">Get Launch Updates</a>
            </div>
            <p className="products-release-note"><span className="products-pulse" aria-hidden="true" /> Collection preview · No products are on sale yet</p>
          </div>
          <div className="products-preview" aria-label="Preview of the SSG digital business resources collection">
            <div className="products-preview-top">
              <span>SSG <b>/</b> RESOURCES</span>
              <span>COLLECTION PREVIEW</span>
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
            <div className="products-preview-bottom"><span><Layers3 size={15} /> SIX PRODUCTS IN THE PIPELINE</span><span>CONCEPT VIEW</span></div>
          </div>
        </div>
      </section>

      <section className="products-status-bar" aria-label="Storefront launch status">
        <div className="container">
          <div className="products-status-copy"><span className="products-status-dot" aria-hidden="true" /><strong>Building the collection.</strong> Browse planned resources and tell us what interests you. Purchasing and downloads are not available yet.</div>
        </div>
      </section>

      <section className="section products-catalog-section" id="product-catalog">
        <div className="container">
          <div className="section-head products-section-heading">
            <div><div className="eyebrow">FIRST IN THE PIPELINE</div><h2 className="h2">Start with what<br />moves business forward.</h2></div>
            <p className="lede section-copy">Our first three development priorities focus on tasks small-business owners can put into practice.</p>
          </div>
          <div className="products-grid">
            {products.filter(item => item.priority).map(({ number, category, title, description, includes, Icon, priority }) => (
              <article className={'products-card' + (priority ? ' products-card-priority' : '')} key={number}>
                <div className="products-card-top">
                  <span className="products-card-index">{number} / 06</span>
                  <span className="products-card-status">{priority ? 'IN DEVELOPMENT' : 'PLANNED'}</span>
                </div>
                <div className="products-card-symbol" aria-hidden="true"><Icon size={30} strokeWidth={1.65} /></div>
                <div className="products-card-category">{category}</div>
                <h3>{title}</h3>
                <p>{description}</p><div className="products-card-details"><div><span>BEST FOR</span><p>{productDetails[title].audience}</p></div><div><span>PLANNED FORMAT</span><p>{productDetails[title].format}</p></div></div>
                <div className="products-card-divider" />
                <div className="products-card-includes-label">PLANNED CONTENT</div>
                <ul>{includes.map((feature) => <li key={feature}><Check size={15} /> {feature}</li>)}</ul><a className="products-card-interest" href="#launch-list">Interested? Join the launch list <ArrowRight size={16}/></a>
              </article>
            ))}
          </div>
          <div className="products-roadmap-heading"><div><div className="eyebrow">ON THE ROADMAP</div><h2>More tools to come.</h2></div><p>Resources planned for marketing, client operations and AI-assisted workflows.</p></div>
          <div className="products-grid products-grid-roadmap">
            {products.filter(item => !item.priority).map(({ number, category, title, description, includes, Icon, priority }) => (
              <article className={'products-card' + (priority ? ' products-card-priority' : '')} key={number}>
                <div className="products-card-top">
                  <span className="products-card-index">{number} / 06</span>
                  <span className="products-card-status">{priority ? 'IN DEVELOPMENT' : 'PLANNED'}</span>
                </div>
                <div className="products-card-symbol" aria-hidden="true"><Icon size={30} strokeWidth={1.65} /></div>
                <div className="products-card-category">{category}</div>
                <h3>{title}</h3>
                <p>{description}</p><div className="products-card-details"><div><span>BEST FOR</span><p>{productDetails[title].audience}</p></div><div><span>PLANNED FORMAT</span><p>{productDetails[title].format}</p></div></div>
                <div className="products-card-divider" />
                <div className="products-card-includes-label">PLANNED CONTENT</div>
                <ul>{includes.map((feature) => <li key={feature}><Check size={15} /> {feature}</li>)}</ul><a className="products-card-interest" href="#launch-list">Interested? Join the launch list <ArrowRight size={16}/></a>
              </article>
            ))}
          </div>
          <p className="products-catalog-disclaimer">These are previews, not completed offers. Final features, file formats, pricing and release dates may change before launch.</p>
        </div>
      </section>

      <section className="section-tight products-interest-section" id="launch-list">
        <div className="container products-interest-grid">
          <div><div className="eyebrow">BE FIRST TO KNOW</div><h2 className="h2">Which product would<br/><span className="blue">help your business?</span></h2>
            <p className="lede">Tell us what interests you. We will use your feedback to prioritize the collection and email you about relevant releases.</p>
            <p className="products-form-note">No payment required. Signing up does not reserve a product or place an order.</p>
          </div>
          <ProductInterestForm products={products.map(product => product.title)} />
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

      <section className="section products-faq-section">
        <div className="container products-faq-grid">
          <div><div className="eyebrow">GOOD TO KNOW</div><h2 className="h2">A few quick answers.</h2></div>
          <div className="products-faq-list">
            <details><summary>Can I buy these products now?</summary><p>Not yet. Final prices and purchasing will be added after the products and their delivery process are ready.</p></details>
            <details><summary>Will these be downloads or subscriptions?</summary><p>The products here are planned as standalone digital downloads. SSG Business OS is a separate software platform.</p></details>
            <details><summary>Which file formats will be available?</summary><p>Depending on the product, we expect editable spreadsheets, document templates or guides. We will confirm formats and compatibility before sales open.</p></details>
            <details><summary>What happens when I join the launch list?</summary><p>We record your interest and can email you about relevant product releases. Signing up does not create an account or charge you.</p></details>
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
