import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export const DEFAULT_ENDPOINT = "https://app.smol.ly";
export const MCP_SERVER_NAME = "smolify";
export const SKILL_NAME = "smolify-api-docs";
export const REMOTE_BRIDGE_VERSION = "0.1.38";

export type AgentId =
  | "codex"
  | "claude"
  | "gemini"
  | "devin"
  | "graff"
  | "forge"
  | "cursor"
  | "windsurf"
  | "opencode"
  | "droid";

type AgentTarget = {
  id: AgentId;
  label: string;
  relativePath: string;
  style: AgentStyle;
  scope?: "home" | "project";
  detectionPath?: string;
};

export type JsonStyle =
  | "standard"
  | "claude"
  | "gemini"
  | "devin"
  | "graff"
  | "forge"
  | "cursor"
  | "windsurf"
  | "opencode"
  | "droid";

type AgentStyle = "codex" | JsonStyle;

export const AGENT_TARGETS: readonly AgentTarget[] = [
  { id: "codex", label: "Codex", relativePath: ".codex/config.toml", style: "codex", detectionPath: ".codex" },
  { id: "claude", label: "Claude Code", relativePath: ".claude.json", style: "claude", detectionPath: ".claude" },
  { id: "gemini", label: "Gemini", relativePath: ".gemini/settings.json", style: "gemini", detectionPath: ".gemini" },
  { id: "devin", label: "Devin", relativePath: ".config/devin/config.json", style: "devin", detectionPath: ".config/devin" },
  { id: "graff", label: "Graff", relativePath: ".mcp.json", style: "graff", scope: "project" },
  { id: "forge", label: "Forge", relativePath: "forge/.mcp.json", style: "forge", detectionPath: "forge" },
  { id: "cursor", label: "Cursor", relativePath: ".cursor/mcp.json", style: "cursor", detectionPath: ".cursor" },
  { id: "windsurf", label: "Windsurf", relativePath: ".codeium/windsurf/mcp_config.json", style: "windsurf", detectionPath: ".codeium/windsurf" },
  { id: "opencode", label: "OpenCode", relativePath: ".config/opencode/opencode.json", style: "opencode", detectionPath: ".config/opencode" },
  { id: "droid", label: "Droid", relativePath: ".factory/mcp.json", style: "droid", detectionPath: ".factory" },
];

export type InstallerAction = {
  kind: "mcp" | "skill";
  label: string;
  path: string;
  changed: boolean;
  removed?: boolean;
};

export type InstallerOptions = {
  home: string;
  cwd?: string;
  endpoint?: string;
  agents?: AgentId[];
  dryRun?: boolean;
  installMcp?: boolean;
  installSkill?: boolean;
  skillSource?: string;
};

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function normalizeEndpoint(endpoint: string) {
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("Smolify endpoint must use HTTPS");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function jsonEntry(endpoint: string, style: JsonStyle) {
  const url = `${endpoint}/mcp`;
  switch (style) {
    case "claude":
      return { type: "http", url };
    case "gemini":
      return { httpUrl: url };
    case "devin":
    case "forge":
    case "cursor":
      return { url };
    case "graff":
      return { command: "npx", args: ["-y", `mcp-remote@${REMOTE_BRIDGE_VERSION}`, url] };
    case "windsurf":
      return { serverUrl: url };
    case "opencode":
      return { type: "remote", url, enabled: true };
    case "droid":
      return { type: "http", url, disabled: false };
    case "standard":
      return { url, transport: "http" };
  }
}

export function patchJsonMcpConfig(
  source: string,
  endpoint: string,
  operation: "install" | "uninstall",
  requestedStyle: JsonStyle | boolean = "standard",
) {
  const style = typeof requestedStyle === "boolean"
    ? requestedStyle ? "claude" : "standard"
    : requestedStyle;
  let parsed: Record<string, unknown>;
  try {
    parsed = source.trim() ? JSON.parse(source) as Record<string, unknown> : {};
  } catch {
    throw new Error("Refusing to modify an invalid JSON agent configuration");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Agent configuration must be a JSON object");
  }
  const containerKey = style === "opencode" ? "mcp" : "mcpServers";
  const current = parsed[containerKey];
  const servers = current && !Array.isArray(current) && typeof current === "object"
    ? { ...(current as Record<string, unknown>) }
    : {};
  if (operation === "install") servers[MCP_SERVER_NAME] = jsonEntry(endpoint, style);
  else delete servers[MCP_SERVER_NAME];
  parsed[containerKey] = servers;
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function tomlSection(line: string) {
  return line.match(/^\s*\[([^\]]+)]\s*(?:#.*)?$/)?.[1]?.trim() ?? null;
}

function isSmolifyTomlSection(section: string) {
  return section === "mcp_servers.smolify"
    || section === 'mcp_servers."smolify"'
    || section.startsWith("mcp_servers.smolify.")
    || section.startsWith('mcp_servers."smolify".');
}

export function patchCodexMcpConfig(
  source: string,
  endpoint: string,
  operation: "install" | "uninstall",
) {
  const kept: string[] = [];
  let skipping = false;
  for (const line of source.split(/\r?\n/)) {
    const section = tomlSection(line);
    if (section) skipping = isSmolifyTomlSection(section);
    if (!skipping) kept.push(line);
  }
  const base = kept.join("\n").trimEnd();
  if (operation === "uninstall") return base ? `${base}\n` : "";
  const block = `[mcp_servers.${MCP_SERVER_NAME}]\nurl = ${JSON.stringify(`${endpoint}/mcp`)}\n`;
  return base ? `${base}\n\n${block}` : block;
}

async function atomicWrite(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.smoly-${randomUUID()}.tmp`;
  await writeFile(temporary, value, { mode: 0o600 });
  await rename(temporary, path);
}

async function readConfig(path: string, fallback: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function targetPath(home: string, cwd: string, target: AgentTarget) {
  return join(target.scope === "project" ? cwd : home, target.relativePath);
}

async function selectedTargets(home: string, cwd: string, agents?: AgentId[]) {
  if (agents?.length) {
    const selected = new Set(agents);
    return AGENT_TARGETS.filter((target) => selected.has(target.id));
  }
  const detected: AgentTarget[] = [];
  for (const target of AGENT_TARGETS) {
    const path = targetPath(home, cwd, target);
    const detectionPath = target.detectionPath
      ? join(target.scope === "project" ? cwd : home, target.detectionPath)
      : null;
    if (await exists(path) || (detectionPath && await exists(detectionPath))) detected.push(target);
  }
  return detected.length ? detected : AGENT_TARGETS.filter((target) => target.id === "codex");
}

async function updateConfig(
  path: string,
  label: string,
  style: AgentStyle,
  endpoint: string,
  operation: "install" | "uninstall",
  dryRun: boolean,
) {
  const before = await readConfig(path, style === "codex" ? "" : "{}\n");
  const after = style === "codex"
    ? patchCodexMcpConfig(before, endpoint, operation)
    : patchJsonMcpConfig(before, endpoint, operation, style);
  const changed = before !== after;
  if (changed && !dryRun) await atomicWrite(path, after);
  return { kind: "mcp", label, path, changed, removed: operation === "uninstall" } satisfies InstallerAction;
}

async function updateSkill(
  home: string,
  skillSource: string | undefined,
  operation: "install" | "uninstall",
  dryRun: boolean,
) {
  const path = join(home, ".agents", "skills", SKILL_NAME);
  const present = await exists(path);
  if (operation === "uninstall") {
    if (present && !dryRun) await rm(path, { recursive: true });
    return { kind: "skill", label: "Agent Skill", path, changed: present, removed: true } satisfies InstallerAction;
  }
  if (!skillSource || !(await exists(join(skillSource, "SKILL.md")))) {
    throw new Error("The packaged Smolify skill is missing");
  }
  if (!dryRun) {
    await mkdir(path, { recursive: true });
    await cp(skillSource, path, { recursive: true, force: true });
  }
  return { kind: "skill", label: "Agent Skill", path, changed: true } satisfies InstallerAction;
}

export async function runInstaller(
  operation: "install" | "uninstall" | "status",
  options: InstallerOptions,
) {
  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_ENDPOINT);
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const installMcp = options.installMcp ?? true;
  const installSkill = options.installSkill ?? true;
  const targets = await selectedTargets(options.home, cwd, options.agents);
  const actions: InstallerAction[] = [];

  if (operation === "status") {
    const sourcePath = join(options.home, ".mcpconfig.json");
    const candidates = [
      { label: "mcpsync source", path: sourcePath, style: "standard" as const },
      ...targets.map((target) => ({ label: target.label, path: targetPath(options.home, cwd, target), style: target.style })),
    ];
    for (const candidate of candidates) {
      const content = await readConfig(candidate.path, "");
      const configured = candidate.style === "codex"
        ? /\[mcp_servers\.(?:"smolify"|smolify)]/.test(content)
        : (() => {
            try {
              const parsed = JSON.parse(content || "{}") as {
                mcp?: Record<string, unknown>;
                mcpServers?: Record<string, unknown>;
              };
              const servers = candidate.style === "opencode" ? parsed.mcp : parsed.mcpServers;
              return Boolean(servers?.[MCP_SERVER_NAME]);
            } catch {
              return false;
            }
          })();
      actions.push({ kind: "mcp", label: candidate.label, path: candidate.path, changed: configured });
    }
    const skillPath = join(options.home, ".agents", "skills", SKILL_NAME);
    actions.push({ kind: "skill", label: "Agent Skill", path: skillPath, changed: await exists(join(skillPath, "SKILL.md")) });
    return actions;
  }

  if (installMcp) {
    actions.push(await updateConfig(
      join(options.home, ".mcpconfig.json"),
      "mcpsync source",
      "standard",
      endpoint,
      operation,
      dryRun,
    ));
    for (const target of targets) {
      actions.push(await updateConfig(
        targetPath(options.home, cwd, target),
        target.label,
        target.style,
        endpoint,
        operation,
        dryRun,
      ));
    }
  }
  if (installSkill) actions.push(await updateSkill(options.home, options.skillSource, operation, dryRun));
  return actions;
}

export function parseAgentIds(value: string) {
  const requested = value.split(",").map((item) => item.trim()).filter(Boolean);
  const known = new Set(AGENT_TARGETS.map((target) => target.id));
  const unknown = requested.filter((item) => !known.has(item as AgentId));
  if (unknown.length) throw new Error(`Unknown agent: ${unknown.join(", ")}`);
  return [...new Set(requested)] as AgentId[];
}

export function shouldAutoInstall(environment: NodeJS.ProcessEnv) {
  if (environment.SMOLIFY_SKIP_POSTINSTALL === "1") return false;
  if (environment.SMOLIFY_AUTO_INSTALL === "1") return true;
  return environment.npm_config_global === "true" || environment.npm_config_global === "1";
}
