'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ReviewAuthRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/review' || !window.location.hash.includes('invite_token=')) return;
    window.location.replace(`/review${window.location.hash}`);
  }, [pathname]);

  return null;
}
