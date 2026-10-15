import type { Metadata } from 'next';
import './globals.css';
import './website.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: { default: 'Shipley Solutions Group | Custom Business Websites', template: '%s | Shipley Solutions Group' },
  description: 'Custom websites for businesses and organizations, with practical CRM, automation and local visibility support. Work directly with founder Jaden Shipley.',
  metadataBase: new URL('https://shipleysolutionsgroup.com'),
  openGraph: { title: 'Shipley Solutions Group | Custom Business Websites', description: 'Clear messaging, thoughtful web design and a simple path to customer inquiries.', type: 'website' },
  other: { 'ssg-release': 'website-first-manual-review-2026-10' },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://shipleysolutionsgroup.com/#organization',
      name: 'Shipley Solutions Group Inc.',
      alternateName: ['Shipley Solutions Group', 'SSG'],
      url: 'https://shipleysolutionsgroup.com/',
      logo: 'https://shipleysolutionsgroup.com/ssg-logo.png',
      founder: { '@id': 'https://jadenshipley.com/#jaden' },
    },
    {
      '@type': 'Person',
      '@id': 'https://jadenshipley.com/#jaden',
      name: 'Jaden Shipley',
      url: 'https://jadenshipley.com/',
      jobTitle: 'Founder & CEO',
      worksFor: { '@id': 'https://shipleysolutionsgroup.com/#organization' },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, '\\u003c') }}
    />
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Nav />{children}<Footer />
  </body></html>;
}
