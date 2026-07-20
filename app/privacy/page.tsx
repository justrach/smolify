import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Smolify collects, uses, shares, and protects personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <nav className="legal-nav">
        <Brand />
        <div><Link href="/">Home</Link><Link href="/terms">Terms</Link></div>
      </nav>
      <article className="legal-document">
        <header>
          <p className="eyebrow">Legal · Privacy</p>
          <h1>Privacy Policy</h1>
          <p className="legal-effective">Effective and last updated: 20 July 2026</p>
          <p>This policy explains how Smolify (“Smolify”, “we”, “us”, or “our”) handles personal data when you visit app.smol.ly, use a Smolify-hosted documentation site, connect an MCP client, import a repository, or use related services (collectively, the “Service”).</p>
        </header>

        <section>
          <h2>1. Scope and our role</h2>
          <p>For account, website, security, and service-administration data, Smolify decides why and how the data is processed. For repository content that a workspace submits, Smolify generally processes that content to provide the Service at the workspace owner’s direction. Public repository content and documentation may already be publicly available.</p>
          <p>This policy does not govern GitHub, your AI or MCP client provider, a customer’s independently operated custom domain, or other third-party services. Their own terms and privacy notices apply.</p>
        </section>

        <section>
          <h2>2. Information we collect</h2>
          <div className="legal-data-grid">
            <div><h3>Account information</h3><p>Name, email address, password-derived verifier, account and session identifiers, and—if enabled and selected—GitHub identity and authorization information.</p></div>
            <div><h3>Workspace and repository information</h3><p>Project names, visibility, repository URLs, branches and commits, uploaded archives, generated Markdown, source provenance, deployment history, custom-domain settings, and publish-token hashes.</p></div>
            <div><h3>Community content</h3><p>Documentation ratings, proposed improvements, review decisions, associated account identity, model label, and timestamps.</p></div>
            <div><h3>Technical information</h3><p>IP address, user agent, request metadata, authentication and security events, cookies, error information, and similar operational logs processed by Smolify or Cloudflare.</p></div>
            <div><h3>Communications</h3><p>Information you provide in support, privacy, security, or other messages to us.</p></div>
          </div>
          <p>We receive information directly from you, automatically from your browser or MCP client, from workspace members, and from services you connect, such as GitHub. Please do not upload secrets, credentials, or personal data that is unnecessary for documentation.</p>
        </section>

        <section>
          <h2>3. How we use information</h2>
          <ul>
            <li>Provide, authenticate, secure, troubleshoot, and improve the Service.</li>
            <li>Import repositories; generate, search, review, store, and publish documentation; and serve custom domains.</li>
            <li>Operate project-scoped MCP authorization and distinguish public reads from private or mutating operations.</li>
            <li>Prevent abuse, enforce our Terms, investigate incidents, and comply with law.</li>
            <li>Respond to support, privacy, and security requests and send essential service notices.</li>
          </ul>
          <p>We do not use your personal data for third-party advertising. Smolify does not run a hosted answer model over your repository content; an AI or MCP client you choose may process information under your separate relationship with that provider.</p>
        </section>

        <section>
          <h2>4. When we disclose information</h2>
          <p>We disclose information only as reasonably needed to operate the Service, at your direction, or as required by law:</p>
          <ul>
            <li><strong>Infrastructure providers.</strong> Cloudflare provides application hosting, network security, D1 database, and R2 object storage services.</li>
            <li><strong>Connected services.</strong> GitHub receives repository and API requests when you connect or import from GitHub.</li>
            <li><strong>Workspace members and the public.</strong> Workspace members can access workspace content according to their permissions. Public projects expose published documentation, repository provenance, ratings, and review information to anyone.</li>
            <li><strong>Legal and safety disclosures.</strong> We may preserve or disclose information when reasonably necessary to comply with law, protect rights and safety, investigate abuse, or respond to a valid legal process.</li>
            <li><strong>Business transfers.</strong> Information may transfer as part of a merger, financing, reorganization, or sale, subject to appropriate confidentiality and notice where required.</li>
          </ul>
          <p>We do not sell personal information or share it for cross-context behavioural advertising, and we do not process personal data for targeted advertising.</p>
        </section>

        <section>
          <h2>5. Public and private projects</h2>
          <p>Choose project visibility carefully. Public projects, their published documentation, source links, and community review activity are intentionally public and may be indexed, copied, or cached by others. Private projects require authentication, but workspace owners control who is invited and what is uploaded or published.</p>
          <p>Dashboard session cookies are host-only and are not sent to customer custom domains. Publish tokens are project-scoped, shown once, and stored by Smolify only as SHA-256 hashes.</p>
        </section>

        <section>
          <h2>6. Cookies and similar technologies</h2>
          <p>Smolify uses cookies and local browser storage that are necessary for authentication, security, OAuth flows, and user-requested functionality. We do not currently use third-party behavioural advertising cookies or third-party analytics cookies. Your browser may let you block cookies, but authentication and private features may stop working.</p>
        </section>

        <section>
          <h2>7. Retention</h2>
          <p>We retain personal data for as long as reasonably necessary to provide the Service, maintain security and auditability, resolve disputes, enforce agreements, and meet legal obligations. Retention depends on the type of record, project visibility, workspace instructions, active deployments, and legitimate legal or business needs.</p>
          <p>When data is no longer needed, we delete it or remove the means by which it can reasonably be associated with an individual. Residual copies may remain temporarily in backups, immutable deployment records, or security logs until their normal expiry, unless longer retention is legally required.</p>
        </section>

        <section>
          <h2>8. Security</h2>
          <p>We use administrative and technical safeguards appropriate to the nature of the Service, including scoped authorization, prepared database statements, tenant-scoped storage keys, host-only dashboard cookies, hashed publish tokens, HTML sanitization, and encrypted network transport. No system is completely secure, so we cannot guarantee absolute security.</p>
        </section>

        <section>
          <h2>9. International transfers</h2>
          <p>Smolify and its providers may process information in Singapore, the United States, and other countries where they operate. Where Singapore’s Personal Data Protection Act 2012 (“PDPA”) applies, we take steps intended to ensure that overseas recipients provide a standard of protection comparable to the PDPA, including contractual, technical, and organisational safeguards as appropriate.</p>
        </section>

        <section>
          <h2>10. Your privacy rights</h2>
          <p>Depending on where you live and subject to legal exceptions, you may ask us to confirm processing; access, correct, delete, or obtain a portable copy of personal data; withdraw consent; restrict or object to certain processing; or appeal a denied request. We may verify your identity and authority before completing a request. We will not discriminate against you for exercising a privacy right.</p>
          <h3>Singapore</h3>
          <p>Under the PDPA, you may request access to personal data about you and information about its use or disclosure, request correction, and withdraw consent with reasonable notice. Withdrawal may prevent us from continuing to provide account or private-project features. You may also contact Singapore’s <a href="https://www.pdpc.gov.sg/" rel="noreferrer">Personal Data Protection Commission</a>.</p>
          <h3>United States</h3>
          <p>Residents of states with applicable comprehensive privacy laws may have rights to know, access, correct, delete, or obtain a portable copy of personal data and to opt out of sale, targeted advertising, or certain profiling. Smolify does not sell personal data, share it for cross-context behavioural advertising, or use it for targeted advertising. Where legally required, we treat a recognised opt-out preference signal, including Global Privacy Control, as a request for the browser or device that sends it.</p>
          <h3>California notice</h3>
          <p>In the preceding 12 months, the categories we may have collected are identifiers; account and customer records; internet or other electronic-network activity; professional information supplied through GitHub; communications; and account login information treated as sensitive personal information. We collect these from the sources and for the purposes described above. We may disclose them to infrastructure providers, connected services, workspace members, and legal recipients as described above. We do not use sensitive personal information to infer characteristics about you.</p>
          <p>To exercise a right or appeal a decision, email <a href="mailto:privacy@smol.ly">privacy@smol.ly</a> with the subject “Privacy Request” or “Privacy Appeal”. An authorised agent may submit a request where permitted by law, but we may require proof of authority and identity.</p>
        </section>

        <section>
          <h2>11. Children</h2>
          <p>The Service is intended for adults and professional developers, not children. You must be at least 18 years old or the age of legal majority where you live to create an account. We do not knowingly collect personal data from children.</p>
        </section>

        <section>
          <h2>12. Changes to this policy</h2>
          <p>We may update this policy to reflect changes to the Service or law. We will update the date above and provide additional notice when required. Material changes apply prospectively unless law permits otherwise.</p>
        </section>

        <section>
          <h2>13. Contact and data protection enquiries</h2>
          <p>Smolify’s Data Protection Contact can be reached at <a href="mailto:privacy@smol.ly">privacy@smol.ly</a>. Please use that address for privacy questions, complaints, access or correction requests, consent withdrawal, and U.S. state privacy requests.</p>
        </section>
      </article>
    </main>
  );
}
