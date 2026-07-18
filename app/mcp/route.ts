import { getCloudflareContext } from "@opennextjs/cloudflare";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createSmolifyMcpServer } from "@/lib/mcp/server";
import { unauthorizedMcpResponse, verifyMcpAccessToken } from "@/lib/mcp/auth";

export const runtime = "nodejs";

async function handler(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
        "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate",
      },
    });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return unauthorizedMcpResponse(origin);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const principal = await verifyMcpAccessToken(env, authorization.slice(7), origin);
    const server = createSmolifyMcpServer(env, principal, origin);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return await transport.handleRequest(request, {
      authInfo: {
        token: authorization.slice(7),
        clientId: principal.clientId ?? "dynamic-public-client",
        scopes: [...principal.scopes],
      },
    });
  } catch {
    return unauthorizedMcpResponse(origin);
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const OPTIONS = handler;
