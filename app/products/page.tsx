import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bot, CalendarDays, Calculator, Check, ClipboardCheck, Layers3, Rocket, Target, Workflow } from 'lucide-react';
import { bundleOffer, productCatalog } from '@/lib/digitalProducts';
import ProductInterestForm from '@/components/ProductInterestForm';
import './products.css';

export const metadata: Metadata = {
  title: 'Digital Business Products & Bundles',
  description: 'Explore the six packaged SSG business resources: sales, pricing, startup planning, marketing, onboarding and AI workflows. Checkout coming soon.',
  alternates: { canonical: '/products' },
  openGraph: {
    title: 'SSG Digital Business Products | Shipley Solutions Group',
    description: 'Six practical business toolkits plus a discounted bundle. Explore the collection and register for launch updates.',
    url: '/products',
    type: 'website',
  },
};

const productIcons = [Target, Calculator, Rocket, CalendarDays, ClipboardCheck, Bot] as const;

export default function ProductsPage() {
  return (
    <main id="main-content" className="products-page">
      <section className="products-hero">
        <div className="container products-hero-grid">
          <div className="products-hero-copy">
            <div className="eyebrow">SSG DIGITAL PRODUCT COLLECTION</div>
            <h1 className="display products-display">Work smarter.<br /><span className="blue">Build a stronger business.</span></h1>
            <p className="lede">Six downloadable toolkits for the real work behind a small business: winning clients, pricing services, planning, marketing, onboarding and AI workflows.</p>
            <div className="products-hero-actions">
              <a className="btn btn-primary" href="#product-catalog">Explore All Six <ArrowRight size={18} /></a>
              <Link className="btn btn-secondary" href={`/products/${bundleOffer.slug}`}>Explore the $199 Bundle</Link>
            </div>
            <p className="products-release-note"><span className="products-pulse" aria-hidden="true" /> Files prepared · Secure checkout and automatic delivery coming soon</p>
          </div>
          <div className="products-preview" aria-label="Illustration of the SSG digital resource collection">
            <div className="products-preview-top"><span>SSG <b>/</b> RESOURCES</span><span>THE DIGITAL COLLECTION</span></div>
            <div className="products-preview-body">
              <div className="products-preview-kicker">PRACTICAL TOOLS. REAL WORKFLOWS.</div>
              <h2>Less busywork.<br /><em>More momentum.</em></h2>
              <p>Editable workbooks, playbooks and templates built for founders and small teams.</p>
              <div className="products-preview-tiles">
                <div><Target size={24} /><span>WIN CLIENTS</span></div>
                <div><Calculator size={24} /><span>KNOW YOUR NUMBERS</span></div>
                <div><Workflow size={24} /><span>RUN BETTER</span></div>
              </div>
            </div>
            <div className="products-preview-bottom"><span><Layers3 size={15} /> SIX TOOLKITS PACKAGED</span><span>SSG / 001—006</span></div>
          </div>
        </div>
      </section>

      <section className="products-status-bar" aria-label="Storefront checkout status"><div className="container">
        <div className="products-status-copy"><span className="products-status-dot" aria-hidden="true" /><strong>Product files are prepared.</strong> We're configuring payments and secure download delivery. No purchases are being accepted on this site yet.</div>
      </div></section>

      <section className="section products-catalog-section" id="product-catalog">
        <div className="container">
          <div className="section-head products-section-heading">
            <div><div className="eyebrow">THE SIX PRODUCT TOOLKITS</div><h2 className="h2">Find the right tool<br />for your next move.</h2></div>
            <p className="lede section-copy">Explore deliverables, compatibility, and practical use cases. Select any product to see its full breakdown and proposed launch price.</p>
          </div>
          <div className="products-grid">
            {productCatalog.map((product, i) => {
              const Icon = productIcons[i];
              return (
                <article className={'products-card' + (i < 3 ? ' products-card-priority' : '')} key={product.slug}>
                  <div className="products-card-top">
                    <span className="products-card-index">{product.number} / 06</span>
                    <span className="products-card-status">CHECKOUT COMING SOON</span>
                  </div>
                  <div className="products-card-symbol" aria-hidden="true"><Icon size={30} strokeWidth={1.65} /></div>
                  <div className="products-card-category">{product.category}</div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="products-card-details">
                    <div><span>BEST FOR</span><p>{product.audience}</p></div>
                    <div><span>FILE FORMATS</span><p>{product.formats.join(' · ')}</p></div>
                  </div>
                  <div className="products-card-divider"/>
                  <div className="products-card-includes-label">WHAT'S INCLUDED</div>
                  <ul>{product.highlights.slice(0,3).map(feature => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
                  <div className="products-card-price-row">
                    <span>PROPOSED PRICE</span><strong>${product.price}</strong>
                  </div>
                  <Link className="products-card-detail-link" href={`/products/${product.slug}`}>View Product Details <ArrowRight size={18}/></Link>
                </article>
              );
            })}
          </div>
          <p className="products-catalog-disclaimer">Pricing is proposed until checkout goes live. These are standalone downloadable resources; third-party tools, custom implementation and SSG Business OS are not included.</p>
        </div>
      </section>

      <section className="section-tight products-bundle-section">
        <div className="container products-bundle-feature">
          <div>
            <div className="eyebrow">BEST COLLECTION VALUE</div>
            <h2 className="h2">Everything in one bundle.</h2>
            <p className="lede">Get all six SSG business toolkits for a single proposed price. Build a repeatable operating foundation across sales, finance, launch planning, marketing, client delivery and AI adoption.</p>
            <div className="products-bundle-chips"><span>6 complete products</span><span>Editable workbooks</span><span>Templates & guides</span></div>
            <Link href={`/products/${bundleOffer.slug}`} className="btn btn-primary">See the Complete Bundle <ArrowRight size={18}/></Link>
          </div>
          <div className="products-bundle-price"><span>SSG BUSINESS GROWTH BUNDLE</span><strong>$199</strong><p>Regular individual total <s>$394</s></p><div>Save $195 with the bundle</div><small>Proposed pricing · Checkout coming soon</small></div>
        </div>
      </section>

      <section className="section-tight products-interest-section" id="launch-list">
        <div className="container products-interest-grid">
          <div><div className="eyebrow">BE FIRST TO KNOW</div><h2 className="h2">Get notified when<br/><span className="blue">sales go live.</span></h2>
            <p className="lede">We are preparing secure payments and downloads. Let us know which product interests you so we can email you about relevant launches.</p>
            <p className="products-form-note">No payment required. Joining does not create a purchase or reserve a product.</p>
          </div>
          <ProductInterestForm products={[...productCatalog.map(product => product.name), bundleOffer.name]} />
        </div>
      </section>

      <section className="section-tight products-value-section">
        <div className="container products-value-grid">
          <div><div className="eyebrow">THE SSG APPROACH</div><h2 className="h2">Built to use.<br />Not just to read.</h2><p className="lede">Every package contains workbooks, scripts, planning tools or templates you can customize and start using in your own workflow.</p></div>
          <div className="products-value-points">
            <div><span>01</span><div><h3>Practical, editable resources</h3><p>Use the included tools as a starting point, then customize them for your business.</p></div></div>
            <div><span>02</span><div><h3>Made for small teams</h3><p>Designed around the needs of founders, independent operators and growing organizations.</p></div></div>
            <div><span>03</span><div><h3>Separate from Business OS</h3><p>One-time digital downloads are different from our upcoming software subscription platform.</p></div></div>
          </div>
        </div>
      </section>

      <section className="section products-faq-section"><div className="container products-faq-grid">
        <div><div className="eyebrow">STORE QUESTIONS</div><h2 className="h2">A few quick answers.</h2></div>
        <div className="products-faq-list">
          <details><summary>Can I purchase the toolkits right now?</summary><p>Not yet. The product packages are prepared, but secure payments and download fulfillment are still being configured and tested.</p></details>
          <details><summary>What will I get after purchase?</summary><p>Each product contains a customer ZIP download with the formats, templates and guides shown on its detail page. Delivery instructions will be confirmed once checkout is live.</p></details>
          <details><summary>Are these subscriptions or software apps?</summary><p>No. These are standalone downloadable toolkits. SSG Business OS is a separate software project.</p></details>
          <details><summary>Will these products automate my business for me?</summary><p>No. Workbooks and templates are ready to customize; third-party integrations, automated publishing, CRM hosting and custom implementation are not included.</p></details>
        </div>
      </div></section>

      <section className="section-tight"><div className="container products-bottom-cta">
        <div><div className="eyebrow">NEED CUSTOM WORK?</div><h2>Tools aren't the whole story.</h2><p>SSG also helps companies design websites and evaluate systems to support their customer journey.</p></div>
        <Link className="btn btn-primary" href="/services">Explore SSG Services <ArrowUpRight size={18}/></Link>
      </div></section>
    </main>
  );
}
