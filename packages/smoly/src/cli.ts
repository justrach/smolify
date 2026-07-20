import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { probeMcpEndpoint } from "./doctor.js";
import { DEFAULT_ENDPOINT, parseAgentIds, runInstaller, type AgentId } from "./installer.js";

declare const SMOLY_VERSION: string;

const VERSION = SMOLY_VERSION;

function help() {
  console.log(`smolify ${VERSION}

Install Smolify for coding agents.

Usage:
  smolify install [options]
  smolify status [options]
  smolify doctor [options]
  smolify uninstall [options]

Options:
  --agent <ids>       Comma-separated agents (codex, claude, cursor, ...)
  --endpoint <url>    Smolify origin (default: ${DEFAULT_ENDPOINT})
  --mcp-only          Configure the MCP without installing the skill
  --skill-only        Install the skill without configuring the MCP
  --dry-run           Show changes without writing files
  -h, --help          Show this help
  -v, --version       Show the version`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) return help();
  if (args.includes("--version") || args.includes("-v")) return console.log(VERSION);
  const command = args[0] && !args[0].startsWith("-") ? args.shift()! : "install";
  if (!(["install", "uninstall", "status", "doctor"] as const).includes(command as "install" | "uninstall" | "status" | "doctor")) {
    throw new Error(`Unknown command: ${command}`);
  }

  let endpoint = DEFAULT_ENDPOINT;
  let agents: AgentId[] | undefined;
  let dryRun = false;
  let installMcp = true;
  let installSkill = true;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--agent") agents = parseAgentIds(args[++index] ?? "");
    else if (arg === "--endpoint") endpoint = args[++index] ?? "";
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--mcp-only") installSkill = false;
    else if (arg === "--skill-only") installMcp = false;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (command === "doctor") {
    const health = await probeMcpEndpoint(endpoint);
    console.log(`Smolify MCP ready\n  ✓ ${health.endpoint}\n  ✓ ${health.serverName} ${health.serverVersion}\n  ✓ protocol ${health.protocolVersion}\n  ✓ ${health.tools.length} tools`);
    return;
  }

  const skillSource = fileURLToPath(new URL("./skill", import.meta.url));
  const actions = await runInstaller(command as "install" | "uninstall" | "status", {
    home: homedir(),
    endpoint,
    agents,
    dryRun,
    installMcp,
    installSkill,
    skillSource,
  });

  console.log(command === "status" ? "Smolify agent status" : `${dryRun ? "Would update" : command === "install" ? "Installed" : "Uninstalled"} Smolify`);
  for (const action of actions) {
    const marker = command === "status"
      ? action.changed ? "✓" : "·"
      : action.changed ? dryRun ? "~" : "✓" : "·";
    console.log(`  ${marker} ${action.label}: ${action.path}`);
  }
  if (command === "install" && !dryRun) {
    console.log("\nPublic docs work immediately. Restart open agents after first install.");
    console.log("For private docs or publishing in Codex: codex mcp login smolify");
    try {
      const health = await probeMcpEndpoint(endpoint);
      console.log(`MCP verified: ${health.tools.length} tools at ${health.endpoint}`);
    } catch (error) {
      console.warn(`MCP configuration installed, but the live check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch((error) => {
  console.error(`smolify: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
