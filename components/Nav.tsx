import Image from 'next/image';
import Link from 'next/link';

export default function Nav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link className="brand" href="/">
          <Image src="/ssg-logo.png" alt="Shipley Solutions Group logo" width={44} height={44} priority />
          <div><strong>Shipley Solutions Group</strong><span>Strategy · Systems · Growth</span></div>
        </Link>
        <nav className="navlinks" aria-label="Main navigation">
          <Link href="/services">Services</Link>
          <Link href="/about">About</Link>
          <Link href="/audit">Free Audit</Link>
          <Link className="btn btn-primary" href="/contact">Start a Conversation</Link>
        </nav>
      </div>
    </header>
  );
}
