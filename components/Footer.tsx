import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>© {new Date().getFullYear()} Shipley Solutions Group Inc. All rights reserved.</div>
        <div className="footer-links">
          <Link href="/services">Websites</Link>
          <Link href="/work">Our Work</Link>
          <Link href="/audit">Free Website Review</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
