import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  patchCodexMcpConfig,
  patchJsonMcpConfig,
  runInstaller,
  shouldAutoInstall,
} from "../dist/installer.js";
import { probeMcpEndpoint } from "../dist/doctor.js";

const skillSource = resolve(import.meta.dirname, "../dist/skill");

test("JSON configuration is additive and preserves foreign servers", () => {
  const source = JSON.stringify({ theme: "dark", mcpServers: { deepwiki: { url: "https://mcp.deepwiki.com/mcp" } } });
  const installed = JSON.parse(patchJsonMcpConfig(source, "https://app.smol.ly", "install"));
  assert.equal(installed.theme, "dark");
  assert.equal(installed.mcpServers.deepwiki.url, "https://mcp.deepwiki.com/mcp");
  assert.deepEqual(installed.mcpServers.smolify, { url: "https://app.smol.ly/mcp", transport: "http" });
  const removed = JSON.parse(patchJsonMcpConfig(JSON.stringify(installed), "https://app.smol.ly", "uninstall"));
  assert.equal(removed.mcpServers.smolify, undefined);
  assert.ok(removed.mcpServers.deepwiki);
});

test("Codex TOML patch replaces only the Smolify block", () => {
  const source = `model = "gpt-5.6"\n\n[mcp_servers.deepwiki]\nurl = "https://mcp.deepwiki.com/mcp"\n\n[mcp_servers.smolify]\nurl = "https://old.example/mcp"\n\n[mcp_servers.smolify.env]\nTOKEN = "old"\n\n[features]\nweb_search = true\n`;
  const installed = patchCodexMcpConfig(source, "https://app.smol.ly", "install");
  assert.match(installed, /model = "gpt-5\.6"/);
  assert.match(installed, /mcp_servers\.deepwiki/);
  assert.match(installed, /\[features]/);
  assert.doesNotMatch(installed, /old\.example|TOKEN/);
  assert.equal(installed.match(/\[mcp_servers\.smolify]/g)?.length, 1);
  const removed = patchCodexMcpConfig(installed, "https://app.smol.ly", "uninstall");
  assert.doesNotMatch(removed, /mcp_servers\.smolify/);
  assert.match(removed, /mcp_servers\.deepwiki/);
});

test("installer writes atomically to selected agents and installs the shared skill", async (context) => {
  const home = await mkdtemp(join(tmpdir(), "smoly-test-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  const cursorConfig = join(home, ".cursor/mcp.json");
  await mkdir(dirname(cursorConfig), { recursive: true });
  await writeFile(cursorConfig, JSON.stringify({ editor: { fontSize: 14 }, mcpServers: { foreign: { command: "foreign" } } }));

  await runInstaller("install", { home, agents: ["cursor"], skillSource });
  const cursor = JSON.parse(await readFile(cursorConfig, "utf8"));
  const source = JSON.parse(await readFile(join(home, ".mcpconfig.json"), "utf8"));
  assert.equal(cursor.editor.fontSize, 14);
  assert.equal(cursor.mcpServers.foreign.command, "foreign");
  assert.equal(cursor.mcpServers.smolify.url, "https://app.smol.ly/mcp");
  assert.equal(source.mcpServers.smolify.transport, "http");
  assert.match(await readFile(join(home, ".agents/skills/smolify-api-docs/SKILL.md"), "utf8"), /name: smolify-api-docs/);

  await runInstaller("uninstall", { home, agents: ["cursor"], skillSource });
  const after = JSON.parse(await readFile(cursorConfig, "utf8"));
  assert.ok(after.mcpServers.foreign);
  assert.equal(after.mcpServers.smolify, undefined);
  await assert.rejects(readFile(join(home, ".agents/skills/smolify-api-docs/SKILL.md"), "utf8"), /ENOENT/);
});

test("postinstall auto-registration is global-only and can be overridden", () => {
  assert.equal(shouldAutoInstall({}), false);
  assert.equal(shouldAutoInstall({ npm_config_global: "true" }), true);
  assert.equal(shouldAutoInstall({ npm_config_global: "1" }), true);
  assert.equal(shouldAutoInstall({ npm_config_global: "true", SMOLIFY_SKIP_POSTINSTALL: "1" }), false);
  assert.equal(shouldAutoInstall({ SMOLIFY_AUTO_INSTALL: "1" }), true);
});

test("MCP doctor performs initialize and tool discovery", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    const request = JSON.parse(init.body);
    calls.push({ url, request });
    const result = request.method === "initialize"
      ? { protocolVersion: "2025-06-18", serverInfo: { name: "smolify", version: "1.2.3" } }
      : { tools: [{ name: "discover_public_projects" }, { name: "search_docs" }] };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const health = await probeMcpEndpoint("https://app.smol.ly/", fakeFetch);
  assert.equal(health.endpoint, "https://app.smol.ly/mcp");
  assert.deepEqual(health.tools, ["discover_public_projects", "search_docs"]);
  assert.deepEqual(calls.map((call) => call.request.method), ["initialize", "tools/list"]);
});
