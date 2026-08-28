import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ReviewAuthRedirect from '@/components/ReviewAuthRedirect';

export const metadata: Metadata = {
  title: { default: 'Shipley Solutions Group | Build. Automate. Scale.', template: '%s | Shipley Solutions Group' },
  description: 'Shipley Solutions Group helps businesses grow with websites, automation, CRM systems, AI implementation, lead generation and business strategy.',
  metadataBase: new URL('https://shipleysolutionsgroup.com'),
  openGraph: { title: 'Shipley Solutions Group', description: 'Technology, automation and growth systems for ambitious businesses.', type: 'website' },
  other: { 'ssg-release': 'V4' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ReviewAuthRedirect /><Nav />{children}<Footer /></body></html>;
}
