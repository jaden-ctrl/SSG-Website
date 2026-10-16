'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Motion() {
 const pathname = usePathname();
 useEffect(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!('IntersectionObserver' in window) || preference.matches) return;
  const animations = new Set<Animation>();
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
   if (!entry.isIntersecting) return;
   observer.unobserve(entry.target);
   if (preference.matches) return;
   const animation = entry.target.animate([
    { opacity: 0.65, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' }
   ], { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)' });
   animations.add(animation);
   animation.onfinish = () => animations.delete(animation);
  }), { threshold: 0, rootMargin: '0px 0px -24px 0px' });
  // Never fade out content that the visitor can already see during hydration.
  document.querySelectorAll('.section-head, .service-card, .visual-project, .website-process li, .quote-panel, .review-feature, .cta').forEach(el => {
   if (el.getBoundingClientRect().top >= window.innerHeight) observer.observe(el);
  });
  const stop = () => { if (preference.matches) { observer.disconnect(); animations.forEach(animation => animation.cancel()); animations.clear(); } };
  preference.addEventListener('change', stop);
  return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); preference.removeEventListener('change', stop); };
 }, [pathname]);
 return null;
}
