import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Smolify", template: "%s · Smolify" },
  description: "Tiny setup. Serious, Codex-native API documentation.",
  metadataBase: new URL("https://app.smol.ly"),
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Smolify — Tiny setup. Serious docs.",
    description: "Codex-native API documentation generated from your repository, reviewed in git, and hosted beautifully.",
    url: "https://app.smol.ly",
    siteName: "Smolify",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
