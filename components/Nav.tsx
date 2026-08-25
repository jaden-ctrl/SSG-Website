'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [['/services', 'Services'], ['/about', 'About'], ['/audit', 'Free Audit']] as const;

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    return () => document.body.classList.remove('menu-open');
  }, [open]);

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link className="brand" href="/" aria-label="Shipley Solutions Group home">
          <Image src="/ssg-logo.png" alt="" width={44} height={44} priority />
          <div><strong>Shipley Solutions Group</strong><span>Strategy · Systems · Growth</span></div>
        </Link>
        <nav className="navlinks" aria-label="Main navigation">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          <Link className="btn btn-primary" href="/contact">Start a Conversation</Link>
        </nav>
        <button className="menu-toggle" type="button" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>
          {open ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
      <nav id="mobile-navigation" className={`mobile-nav ${open ? 'is-open' : ''}`} aria-label="Mobile navigation">
        <div className="container mobile-nav-inner">
          {links.map(([href, label], index) => <Link key={href} href={href} style={{ '--menu-index': index } as React.CSSProperties}>{label}</Link>)}
          <Link className="btn btn-primary" href="/contact" style={{ '--menu-index': 3 } as React.CSSProperties}>Start a Conversation</Link>
        </div>
      </nav>
    </header>
  );
}
