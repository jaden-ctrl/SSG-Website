import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, FileArchive, FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import { bundleOffer, getProductBySlug, productCatalog } from '@/lib/digitalProducts';
import '../products.css';
import './detail.css';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...productCatalog.map(product => ({ slug: product.slug })), { slug: bundleOffer.slug }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  const title = product?.name ?? (slug === bundleOffer.slug ? bundleOffer.name : 'Product not found');
  const description = product?.description ?? bundleOffer.description;
  return {
    title: `${title} | SSG Digital Products`,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: { title: `${title} | Shipley Solutions Group`, description, url: `/products/${slug}`, type: 'website' },
  };
}

function ComingSoon({ name, price }: { name: string; price: number }) {
  return (
    <aside className="ssg-purchase-panel" aria-label="Purchase availability">
      <div className="ssg-purchase-top"><span>PROPOSED LAUNCH PRICE</span><strong>${price}</strong></div>
      <p className="ssg-purchase-status"><span aria-hidden="true" className="products-pulse" /> Checkout setup in progress</p>
      <p>The files are prepared, but secure payment and automated delivery have not been connected. No orders are being accepted yet.</p>
      <a href="/products#launch-list" className="btn btn-primary ssg-full-button">Get launch updates <ArrowRight size={18} /></a>
      <p className="ssg-purchase-footnote">No charge to join the interest list. This does not reserve ${name}.</p>
    </aside>
  );
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  if (slug === bundleOffer.slug) {
    return (
      <main className="ssg-product-detail" id="main-content">
        <section className="ssg-detail-hero">
          <div className="container">
            <Link href="/products" className="ssg-detail-back"><ArrowLeft size={16}/> All digital products</Link>
            <div className="ssg-detail-bundle-grid">
              <div>
                <div className="eyebrow">THE COMPLETE SSG COLLECTION</div>
                <h1 className="display ssg-detail-headline">One bundle.<br/><span className="blue">Six ways to grow.</span></h1>
                <p className="lede">{bundleOffer.description}</p>
                <div className="ssg-detail-tags"><span>6 customer downloads</span><span>Editable business tools</span><span>One-time proposed price</span></div>
                <div className="ssg-savings"><strong>Save ${bundleOffer.regularPrice - bundleOffer.price}</strong> compared with the proposed individual prices (${bundleOffer.regularPrice}).</div>
              </div>
              <ComingSoon name="the bundle" price={bundleOffer.price}/>
            </div>
          </div>
        </section>
        <section className="section ssg-detail-body">
          <div className="container">
            <div className="eyebrow">ALL SIX INCLUDED</div>
            <h2 className="h2">The complete business toolkit.</h2>
            <div className="ssg-bundle-list">
              {productCatalog.map(product => (
                <Link key={product.slug} className="ssg-bundle-line" href={`/products/${product.slug}`}>
                  <div><span>{product.number}</span><strong>{product.name}</strong><small>{product.description}</small></div>
                  <ArrowRight size={19} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <div className="ssg-detail-fine-print">The bundle will contain the same standalone product packages. It does not include third-party subscriptions, custom setup, hosted software or consulting. Purchase and delivery are not active.</div>
          </div>
        </section>
      </main>
    );
  }
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="ssg-product-detail" id="main-content">
      <section className="ssg-detail-hero">
        <div className="container">
          <Link href="/products" className="ssg-detail-back"><ArrowLeft size={16}/> All digital products</Link>
          <div className="ssg-detail-bundle-grid">
            <div>
              <div className="eyebrow">{product.category} · PRODUCT {product.number}</div>
              <h1 className="display ssg-detail-headline">{product.name}</h1>
              <p className="ssg-detail-lead">{product.lead}</p>
              <p className="lede">{product.description}</p>
              <div className="ssg-detail-tags">{product.formats.map(format => <span key={format}>{format}</span>)}</div>
              <div className="ssg-detail-for"><strong>BEST FOR</strong><p>{product.audience}</p></div>
            </div>
            <ComingSoon name={product.name} price={product.price}/>
          </div>
        </div>
      </section>
      <section className="section ssg-detail-body">
        <div className="container ssg-detail-split">
          <div>
            <div className="eyebrow">WHAT'S INSIDE</div>
            <h2 className="h2">Practical files, ready to customize.</h2>
            <ul className="ssg-detail-feature-list">
              {product.highlights.map(item => <li key={item}><FileCheck2 size={22} aria-hidden="true" /><span>{item}</span></li>)}
            </ul>
          </div>
          <div className="ssg-detail-format-card">
            <FileArchive size={28} aria-hidden="true"/>
            <h3>Downloadable business resources</h3>
            <p>The customer package contains editable documents and/or spreadsheets in the formats listed above. The seller's source and listing materials are not included.</p>
            <p>Files are prepared and undergoing the final sales-and-delivery setup. Nothing is downloadable publicly until a secure purchase process is tested.</p>
          </div>
        </div>
      </section>
      <section className="section-tight ssg-detail-how">
        <div className="container">
          <div className="eyebrow">HOW TO USE IT</div>
          <h2 className="h2">A straightforward workflow.</h2>
          <div className="ssg-detail-steps">
            {product.steps.map((step, i) => <div key={step}><span>{String(i+1).padStart(2,'0')}</span><p>{step}</p></div>)}
          </div>
        </div>
      </section>
      <section className="section ssg-detail-faq">
        <div className="container ssg-detail-split">
          <div><div className="eyebrow">BEFORE YOU BUY</div><h2 className="h2">Frequently asked questions.</h2><p className="lede">Clear expectations, no surprise subscriptions.</p></div>
          <div className="ssg-detail-questions">
            {product.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            <details><summary>Can I buy or download it today?</summary><p>Not yet. Finalizing payment processing, file access and automated fulfillment is required before sales open.</p></details>
            <details><summary>Does the price include custom implementation?</summary><p>No. The proposed price covers a standalone downloadable toolkit. Third-party software, hands-on implementation and consulting are separate.</p></details>
          </div>
        </div>
      </section>
      <section className="section-tight">
        <div className="container ssg-detail-bottom">
          <div><div className="eyebrow">BUILD YOUR TOOLKIT</div><h2>Prefer the complete collection?</h2><p>Get all six SSG digital products for the proposed bundle price of ${bundleOffer.price}.</p></div>
          <Link className="btn btn-primary" href={`/products/${bundleOffer.slug}`}>Explore the bundle <ArrowRight size={18}/></Link>
        </div>
      </section>
    </main>
  );
}
