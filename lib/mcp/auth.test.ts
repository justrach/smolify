import { describe, expect, it } from "vitest";
import { anonymousMcpPrincipal, mcpRequestRequiresAuthentication } from "./auth";

function request(method: string, params?: Record<string, unknown>) {
  return new Request("https://app.smol.ly/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

describe("optional MCP authentication", () => {
  it("grants anonymous principals only public read scopes", () => {
    const principal = anonymousMcpPrincipal();
    expect(principal.authenticated).toBe(false);
    expect(principal.userId).toBeNull();
    expect([...principal.scopes]).toEqual(["projects:read", "docs:read"]);
  });

  it("allows initialization and public read tools without OAuth", async () => {
    await expect(mcpRequestRequiresAuthentication(request("initialize"))).resolves.toBe(false);
    await expect(mcpRequestRequiresAuthentication(request("tools/call", { name: "search_docs", arguments: {} }))).resolves.toBe(false);
    await expect(mcpRequestRequiresAuthentication(request("tools/call", { name: "read_docs_structure", arguments: {} }))).resolves.toBe(false);
  });

  it("requires OAuth at the HTTP layer for private and mutating tools", async () => {
    for (const name of ["whoami", "list_projects", "rate_docs", "propose_doc_improvement", "publish_docs"]) {
      await expect(mcpRequestRequiresAuthentication(request("tools/call", { name, arguments: {} }))).resolves.toBe(true);
    }
  });
});
