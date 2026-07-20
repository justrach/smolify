import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="legal-footer">
      <p>© {new Date().getUTCFullYear()} Smolify. Source-grounded documentation for humans and agents.</p>
      <nav aria-label="Legal and support">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="mailto:support@smol.ly">Support</a>
      </nav>
    </footer>
  );
}
