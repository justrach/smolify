import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { anonymousMcpPrincipal } from "./auth";
import { createSmolifyMcpServer } from "./server";

const closeables: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(closeables.splice(0).map((closeable) => closeable.close()));
});

describe("Smolify MCP contract", () => {
  it("advertises the bounded source relationship and synthesis tools as public reads", async () => {
    const server = createSmolifyMcpServer(
      {} as CloudflareEnv,
      anonymousMcpPrincipal(),
      "https://app.smol.ly",
    );
    const client = new Client({ name: "smolify-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    const byName = new Map(tools.tools.map((tool) => [tool.name, tool]));
    for (const name of [
      "build_docs_context",
      "resolve_public_symbols",
      "inspect_public_symbols",
      "read_public_source",
    ]) {
      expect(byName.get(name)?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      });
    }
    expect(byName.get("inspect_public_symbols")?.description).toContain("scoped callers");
    expect(byName.get("build_docs_context")?.description).toContain("does not call embeddings");
  });
});
