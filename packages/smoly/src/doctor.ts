import { normalizeEndpoint } from "./installer.js";

declare const SMOLY_VERSION: string;

type FetchLike = typeof fetch;

type JsonRpcResponse = {
  error?: { code?: number; message?: string };
  result?: Record<string, unknown>;
};

export type McpDoctorResult = {
  endpoint: string;
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
  tools: string[];
};

async function rpc(
  endpoint: string,
  id: number,
  method: string,
  params: Record<string, unknown>,
  fetchImpl: FetchLike,
) {
  const response = await fetchImpl(`${endpoint}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP ${method} returned HTTP ${response.status}`);
  let payload: JsonRpcResponse | undefined;
  try {
    payload = JSON.parse(text) as JsonRpcResponse;
  } catch {
    const data = text.split(/\r?\n/).find((line) => line.startsWith("data:"))?.slice(5).trim();
    if (data) payload = JSON.parse(data) as JsonRpcResponse;
  }
  if (!payload) throw new Error(`MCP ${method} returned an unreadable response`);
  if (payload.error) throw new Error(payload.error.message ?? `MCP ${method} failed`);
  if (!payload.result) throw new Error(`MCP ${method} returned no result`);
  return payload.result;
}

export async function probeMcpEndpoint(endpoint: string, fetchImpl: FetchLike = fetch): Promise<McpDoctorResult> {
  const origin = normalizeEndpoint(endpoint);
  const initialized = await rpc(origin, 1, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smolify-installer", version: SMOLY_VERSION },
  }, fetchImpl);
  const serverInfo = initialized.serverInfo as { name?: string; version?: string } | undefined;
  if (serverInfo?.name !== "smolify") throw new Error(`Unexpected MCP server: ${serverInfo?.name ?? "unknown"}`);
  const listed = await rpc(origin, 2, "tools/list", {}, fetchImpl);
  const tools = Array.isArray(listed.tools)
    ? listed.tools.flatMap((tool) => {
        const name = (tool as { name?: unknown }).name;
        return typeof name === "string" ? [name] : [];
      })
    : [];
  if (!tools.length) throw new Error("Smolify MCP returned no tools");
  return {
    endpoint: `${origin}/mcp`,
    protocolVersion: typeof initialized.protocolVersion === "string" ? initialized.protocolVersion : "unknown",
    serverName: serverInfo.name,
    serverVersion: serverInfo.version ?? "unknown",
    tools,
  };
}
