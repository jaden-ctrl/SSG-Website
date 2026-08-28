import type { Metadata } from 'next';
import ReviewQueue from '@/components/ReviewQueue';

export const metadata: Metadata = {
  title: 'Audit Review Queue',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return (
    <main className="review-page">
      <section className="page-hero">
        <div className="container">
          <ReviewQueue />
        </div>
      </section>
    </main>
  );
}
