'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export default function Motion() {
 const pathname = usePathname();
 useEffect(() => {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
   if (entry.isIntersecting) { entry.target.classList.add('motion-enter'); observer.unobserve(entry.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll('.section-head, .service-card, .visual-project, .website-process li, .quote-panel, .review-feature, .cta').forEach(el => observer.observe(el));
  return () => observer.disconnect();
 }, [pathname]);
 return null;
}
