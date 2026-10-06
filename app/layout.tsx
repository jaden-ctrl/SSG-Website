import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: { default: 'Shipley Solutions Group | Build. Automate. Scale.', template: '%s | Shipley Solutions Group' },
  description: 'Shipley Solutions Group helps businesses grow with websites, automation, CRM systems, AI implementation, lead generation and business strategy.',
  metadataBase: new URL('https://shipleysolutionsgroup.com'),
  openGraph: { title: 'Shipley Solutions Group', description: 'Technology, automation and growth systems for ambitious businesses.', type: 'website' },
  other: { 'ssg-release': 'V4' },
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
    <Nav />{children}<Footer />
  </body></html>;
}
