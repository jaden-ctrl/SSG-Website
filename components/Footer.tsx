import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>© {new Date().getFullYear()} Shipley Solutions Group Inc. All rights reserved.</div>
        <div style={{display:'flex',gap:18}}>
          <Link href="/services">Services</Link>
          <Link href="/audit">Audit</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
