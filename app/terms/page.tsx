import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that govern access to and use of Smolify.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <nav className="legal-nav">
        <Brand />
        <div><Link href="/">Home</Link><Link href="/privacy">Privacy</Link></div>
      </nav>
      <article className="legal-document">
        <header>
          <p className="eyebrow">Legal · Service</p>
          <h1>Terms of Use</h1>
          <p className="legal-effective">Effective and last updated: 20 July 2026</p>
          <p>These Terms of Use (“Terms”) are an agreement between you and Smolify (“Smolify”, “we”, “us”, or “our”) governing your access to app.smol.ly, Smolify-hosted documentation, the Smolify MCP endpoint, command-line tooling, and related services (collectively, the “Service”).</p>
        </header>

        <section>
          <h2>1. Accepting these Terms</h2>
          <p>By creating an account, clicking to accept these Terms, or using a non-public feature of the Service, you agree to these Terms and our <Link href="/privacy">Privacy Policy</Link>. If you use the Service for an organisation, you represent that you have authority to bind it, and “you” includes that organisation.</p>
          <p>You must be at least 18 years old or the age of legal majority where you live and legally capable of entering this agreement. Do not use the Service if you do not agree.</p>
        </section>

        <section>
          <h2>2. What Smolify provides</h2>
          <p>Smolify imports or receives repository material, stores and publishes Markdown documentation bundles, provides search and source provenance, hosts documentation, and exposes read and write operations through an MCP interface. Features may be experimental, change over time, or be subject to project visibility, authentication, usage, and technical limits.</p>
        </section>

        <section>
          <h2>3. Accounts and security</h2>
          <p>You must provide accurate account information, keep credentials and tokens confidential, and promptly notify us at <a href="mailto:security@smol.ly">security@smol.ly</a> if you suspect unauthorised access. You are responsible for activity performed through your account or project-scoped credentials unless caused by our breach of these Terms or applicable law.</p>
          <p>Do not share publish tokens, upload credentials, or place secrets in documentation. Smolify may revoke a token or session when reasonably necessary to protect the Service, a user, or a third party.</p>
        </section>

        <section>
          <h2>4. Repositories and your content</h2>
          <p>“Your Content” means repository material, uploaded archives, documentation, project settings, ratings, proposals, and other material you submit or direct us to process. You retain any rights you have in Your Content.</p>
          <p>You represent that you have the rights and permissions needed for Smolify to receive, process, reproduce, and display Your Content as you direct. Public availability on GitHub does not necessarily grant every right. You are responsible for repository licences, confidentiality duties, personal data, export restrictions, and third-party rights.</p>
          <p>You grant Smolify a worldwide, non-exclusive, royalty-free licence to host, copy, process, transmit, render, and display Your Content only as needed to operate, secure, and improve the Service and fulfil your project settings. This licence ends when the content is deleted from active systems, subject to reasonable backup, security, legal, and immutable-deployment retention.</p>
        </section>

        <section>
          <h2>5. Public projects and publishing</h2>
          <p>Public projects are visible to anyone. Their documentation, repository links, source provenance, reviews, and ratings may be indexed, copied, cached, or used by people and agents. A project owner is responsible for reviewing generated changes and choosing whether to publish them. Community proposals never grant contributors authority to publish on an owner’s behalf.</p>
          <p>Private status is an access control, not a substitute for removing secrets or complying with confidentiality obligations. Customer custom domains remain subject to these Terms unless the customer provides additional terms that do not conflict with Smolify’s operation of the Service.</p>
        </section>

        <section>
          <h2>6. Generated documentation, AI, and MCP clients</h2>
          <p>Documentation and retrieval results may be incomplete, outdated, or wrong. They are not a substitute for inspecting the source, testing the software, or obtaining professional advice. Smolify does not provide legal, security, medical, or financial advice.</p>
          <p>Smolify does not run a hosted answer model over your repository content. An AI agent or MCP client you choose may receive and process information from the Service under your separate agreement with that provider. Review scopes and outputs before authorising a client or publishing a bundle.</p>
        </section>

        <section>
          <h2>7. Acceptable use</h2>
          <p>You may not use the Service to:</p>
          <ul>
            <li>Violate law, intellectual-property, privacy, confidentiality, or contractual rights.</li>
            <li>Upload malware, secrets obtained without authority, or unlawful or harmful material.</li>
            <li>Probe, disrupt, overload, bypass limits, or gain unauthorised access to the Service or another project.</li>
            <li>Misrepresent repository ownership, official publisher status, reviews, ratings, or the origin of documentation.</li>
            <li>Use automated access in a way that materially degrades the Service or ignores published technical controls.</li>
            <li>Resell access to the Service or use it to build a competing hosted service without our written permission, except as allowed by applicable open-source licences.</li>
          </ul>
          <p>Good-faith security research should avoid personal data and disruption and be reported privately to <a href="mailto:security@smol.ly">security@smol.ly</a>.</p>
        </section>

        <section>
          <h2>8. Third-party services and open-source software</h2>
          <p>The Service interoperates with third parties such as Cloudflare, GitHub, domain registrars, AI clients, and repository hosts. We are not responsible for third-party services, content, availability, or terms. Open-source components remain governed by their respective licences.</p>
        </section>

        <section>
          <h2>9. Smolify intellectual property</h2>
          <p>Except for Your Content and third-party or open-source material, Smolify and its licensors retain rights in the Service, branding, design, and software. These Terms give you a limited, revocable, non-transferable right to use the hosted Service in accordance with these Terms; they do not transfer ownership.</p>
          <p>If you send feedback, you permit us to use it without restriction or compensation, but we will not identify you publicly as its source without permission.</p>
        </section>

        <section>
          <h2>10. Availability, changes, and beta features</h2>
          <p>We aim to provide a reliable Service but do not promise uninterrupted or error-free operation. We may add, change, limit, suspend, or discontinue features and may perform maintenance. We will provide reasonable notice of a material discontinuation when practicable.</p>
        </section>

        <section>
          <h2>11. Suspension and termination</h2>
          <p>You may stop using the Service at any time and request account deletion. We may suspend or terminate access when reasonably necessary for security, legal compliance, non-payment if paid services are introduced, material or repeated breach of these Terms, or protection of users and the Service. Where appropriate, we will give notice and an opportunity to cure.</p>
          <p>On termination, your right to use non-public features ends. Provisions that by their nature should survive—including ownership, accrued payment obligations, disclaimers, limits of liability, dispute terms, and lawful retention—will survive.</p>
        </section>

        <section>
          <h2>12. Disclaimers</h2>
          <p>To the maximum extent permitted by law, the Service is provided “as is” and “as available”. We disclaim implied warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation. We do not warrant that generated documentation is complete, secure, correct, or suitable for production decisions.</p>
          <p>Nothing in these Terms excludes a warranty, guarantee, condition, or remedy that cannot lawfully be excluded, including mandatory rights under applicable Singapore or United States consumer-protection law.</p>
        </section>

        <section>
          <h2>13. Limitation of liability</h2>
          <p>To the maximum extent permitted by law, Smolify will not be liable for indirect, incidental, special, exemplary, punitive, or consequential loss; loss of profit, revenue, goodwill, data, or business opportunity; or the cost of substitute services, arising from or related to the Service.</p>
          <p>To the maximum extent permitted by law, Smolify’s aggregate liability arising from or related to the Service will not exceed the greater of (a) the amount you paid Smolify for the Service during the 12 months before the event giving rise to liability or (b) SGD 100.</p>
          <p>These limitations do not apply to liability that cannot be limited by law, including liability for fraud, wilful misconduct, or death or personal injury caused by negligence where exclusion is prohibited. Each limitation applies only to the extent it is reasonable and enforceable in the circumstances.</p>
        </section>

        <section>
          <h2>14. Indemnity for business use</h2>
          <p>If you use the Service for a business or organisation, you will indemnify Smolify against third-party claims, damages, and reasonable costs arising from Your Content, your unlawful use of the Service, or your material breach of sections 4 or 7, except to the extent caused by Smolify. This section does not apply to an individual acting solely as a consumer where prohibited by law.</p>
        </section>

        <section>
          <h2>15. Governing law and disputes</h2>
          <p>These Terms are governed by the laws of Singapore, without regard to conflict-of-law rules. The courts of Singapore have non-exclusive jurisdiction over disputes. Before filing a claim, each party should attempt in good faith for 30 days to resolve it by written notice to the other.</p>
          <p>If you are a consumer, this section does not deprive you of non-waivable rights or the protection of mandatory law in your U.S. state or other place of residence, nor prevent you from bringing a claim in a forum that applicable law requires.</p>
        </section>

        <section>
          <h2>16. Changes to these Terms</h2>
          <p>We may update these Terms. We will post the new version, update the date above, and provide additional notice when required. Material changes apply prospectively. If you do not agree, stop using the Service before the updated Terms take effect.</p>
        </section>

        <section>
          <h2>17. General terms</h2>
          <p>If a provision is unenforceable, it will be limited to the minimum extent necessary and the rest will remain effective. A failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them as part of a merger, reorganisation, or transfer of the Service. These Terms and incorporated notices are the entire agreement concerning the Service unless you and Smolify sign a separate agreement.</p>
        </section>

        <section>
          <h2>18. Contact</h2>
          <p>Questions about these Terms or account access: <a href="mailto:support@smol.ly">support@smol.ly</a>. Privacy requests: <a href="mailto:privacy@smol.ly">privacy@smol.ly</a>. Security reports: <a href="mailto:security@smol.ly">security@smol.ly</a>.</p>
        </section>
      </article>
    </main>
  );
}
