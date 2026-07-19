import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to import repositories, review documentation, and authorize the Smolify MCP.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const { env } = await getCloudflareContext({ async: true });
  return <LoginForm githubEnabled={Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)} />;
}
