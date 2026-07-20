import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { probeMcpEndpoint } from "./doctor.js";
import { DEFAULT_ENDPOINT, runInstaller, shouldAutoInstall } from "./installer.js";

declare const SMOLY_VERSION: string;

const VERSION = SMOLY_VERSION;

async function main() {
  if (!shouldAutoInstall(process.env)) return;
  const skillSource = fileURLToPath(new URL("./skill", import.meta.url));
  const actions = await runInstaller("install", {
    home: homedir(),
    endpoint: DEFAULT_ENDPOINT,
    skillSource,
  });
  const changed = actions.filter((action) => action.changed).length;
  process.stderr.write(`[smolify ${VERSION} postinstall] registered ${changed} MCP/skill target${changed === 1 ? "" : "s"}\n`);
  try {
    const health = await probeMcpEndpoint(DEFAULT_ENDPOINT);
    process.stderr.write(`[smolify ${VERSION} postinstall] MCP ready: ${health.tools.length} tools at ${health.endpoint}\n`);
  } catch (error) {
    process.stderr.write(`[smolify ${VERSION} postinstall] installed, but MCP check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.stderr.write(`[smolify ${VERSION} postinstall] run \"smolify status\" to inspect or \"smolify uninstall\" to remove\n`);
}

main().catch((error) => {
  process.stderr.write(`[smolify ${VERSION} postinstall] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
