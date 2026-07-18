import { SMOLIFY_OAUTH_SCOPES } from "@/lib/auth";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: SMOLIFY_OAUTH_SCOPES.filter((scope) => scope !== "openid"),
      resource_documentation: `${origin}/docs/architecture`,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
