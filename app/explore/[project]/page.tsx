import { permanentRedirect } from "next/navigation";

type PageProps = { params: Promise<{ project: string }> };

/**
 * Project cards used to open a second, promotional landing page before the
 * documentation. Keep old shared links working, but make the canonical
 * experience the documentation itself.
 */
export default async function LegacyPublicProjectPage({ params }: PageProps) {
  const { project } = await params;
  permanentRedirect(`/${encodeURIComponent(project)}/introduction`);
}
