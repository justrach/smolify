import { unzipSync } from "fflate";
import type { DocsBundle, DocsPage } from "@/lib/docs/schema";

export type RepositoryFile = {
  path: string;
  content?: string;
};

export type RepositorySnapshot = {
  name: string;
  description: string;
  sourceUrl: string | null;
  revision: string | null;
  files: RepositoryFile[];
  totalFiles: number;
};

const TEXT_FILE = /(?:^|\/)(?:readme(?:\.[a-z0-9]+)?|license(?:\.[a-z0-9]+)?|dockerfile|gemfile|makefile)$|\.(?:md|mdx|txt|json|ya?ml|toml|ini|conf|xml|graphql|gql|proto|ts|tsx|js|jsx|mjs|cjs|py|rb|rs|go|java|kt|kts|swift|php|cs|c|cc|cpp|h|hpp|sh|sql)$/i;
const CONTENT_PRIORITY = /(?:^|\/)(?:readme(?:\.[a-z0-9]+)?|package\.json|pyproject\.toml|cargo\.toml|go\.mod|composer\.json|gemfile|openapi\.(?:json|ya?ml)|swagger\.(?:json|ya?ml)|schema\.graphql)$/i;
const IGNORED_PATH = /(?:^|\/)(?:\.git|node_modules|vendor|dist|build|coverage|\.next|\.open-next|target|__pycache__)(?:\/|$)/i;

function cleanPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function safePath(path: string) {
  const cleaned = cleanPath(path);
  return Boolean(cleaned) && !cleaned.split("/").includes("..") && !IGNORED_PATH.test(cleaned);
}

function stripCommonRoot(files: RepositoryFile[]) {
  const roots = new Set(files.map((file) => cleanPath(file.path).split("/")[0]).filter(Boolean));
  if (roots.size !== 1) return files;
  const [root] = [...roots];
  if (files.some((file) => !cleanPath(file.path).includes("/"))) return files;
  return files.map((file) => ({ ...file, path: cleanPath(file.path).slice(root.length + 1) }));
}

function inline(value: string) {
  return value.replace(/[\[\]*_`<>]/g, "\\$&").trim();
}

function truncate(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, length)}\n\n…truncated by Smolify import.`;
}

function findContent(files: RepositoryFile[], pattern: RegExp) {
  return files.find((file) => pattern.test(file.path) && file.content)?.content;
}

function packageDevelopment(files: RepositoryFile[]) {
  const raw = findContent(files, /(?:^|\/)package\.json$/i);
  if (!raw) return null;
  try {
    const manifest = JSON.parse(raw) as {
      description?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: Record<string, string>;
    };
    const scripts = Object.entries(manifest.scripts ?? {}).slice(0, 30);
    const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).slice(0, 60);
    const lines = ["# Development", "", "This page is generated from the checked-in package manifest.", ""];
    if (Object.keys(manifest.engines ?? {}).length) {
      lines.push("## Runtime", "", ...Object.entries(manifest.engines ?? {}).map(([name, version]) => `- **${inline(name)}:** \`${version}\``), "");
    }
    if (scripts.length) {
      lines.push("## Commands", "", ...scripts.map(([name, command]) => `- \`npm run ${name}\` — \`${command}\``), "");
    }
    if (dependencies.length) {
      lines.push("## Notable packages", "", dependencies.map((name) => `\`${name}\``).join(", "), "");
    }
    return truncate(lines.join("\n"), 80_000);
  } catch {
    return null;
  }
}

function categorizedPaths(files: RepositoryFile[]) {
  const paths = files.map((file) => file.path).filter(safePath).slice(0, 500);
  const groups = [
    ["API contracts", /(?:openapi|swagger|graphql|\.proto$|schema)/i],
    ["Tests", /(?:^|\/)(?:test|tests|spec|__tests__)(?:\/|\.)|\.(?:test|spec)\./i],
    ["Documentation", /(?:^|\/)(?:docs?|examples?)(?:\/|$)|\.md$/i],
    ["Source", /(?:^|\/)(?:src|app|lib|server|api|routes?|controllers?)(?:\/|$)/i],
    ["Configuration", /(?:^|\/)(?:package\.json|pyproject\.toml|cargo\.toml|go\.mod|dockerfile|wrangler\.|tsconfig|\.github\/)/i],
  ] as const;
  const used = new Set<string>();
  const sections: string[] = ["# Repository map", "", "A bounded, source-grounded map of the imported repository.", ""];
  for (const [label, pattern] of groups) {
    const matched = paths.filter((path) => pattern.test(path) && !used.has(path)).slice(0, 80);
    if (!matched.length) continue;
    matched.forEach((path) => used.add(path));
    sections.push(`## ${label}`, "", ...matched.map((path) => `- \`${path}\``), "");
  }
  const other = paths.filter((path) => !used.has(path)).slice(0, 100);
  if (other.length) sections.push("## Other files", "", ...other.map((path) => `- \`${path}\``), "");
  return truncate(sections.join("\n"), 120_000);
}

export function buildRepositoryBundle(snapshot: RepositorySnapshot): DocsBundle {
  const files = stripCommonRoot(snapshot.files)
    .filter((file) => safePath(file.path))
    .map((file) => ({ ...file, path: cleanPath(file.path) }));
  const readme = findContent(files, /(?:^|\/)readme(?:\.[a-z0-9]+)?$/i);
  const packageRaw = findContent(files, /(?:^|\/)package\.json$/i);
  let packageDescription = "";
  if (packageRaw) {
    try {
      packageDescription = String((JSON.parse(packageRaw) as { description?: string }).description ?? "");
    } catch {
      packageDescription = "";
    }
  }
  const description = truncate(snapshot.description || packageDescription || "An imported software repository.", 220);
  const sourceLine = snapshot.sourceUrl
    ? `\n[View the source repository](${snapshot.sourceUrl})\n`
    : "\nThis repository was uploaded privately. Smolify retained the generated documentation bundle, not the source archive.\n";
  const intro = [
    `# ${inline(snapshot.name)}`,
    "",
    `> ${inline(description)}`,
    sourceLine,
    "## Repository snapshot",
    "",
    `- **Files indexed:** ${snapshot.totalFiles}`,
    `- **Revision:** ${inline(snapshot.revision ?? "uploaded snapshot")}`,
    "- **Initial page:** deterministic repository import; ask Codex to verify and improve it against the source.",
    "",
    readme ? "## README" : "## Next step",
    "",
    readme
      ? truncate(readme, 140_000)
      : "Connect the Smolify MCP in the source repository and ask `$smolify-api-docs` to generate reviewed API documentation.",
  ].join("\n");

  const pages: DocsPage[] = [
    {
      slug: "introduction",
      title: snapshot.name,
      description,
      markdown: truncate(intro, 240_000),
      sourceFiles: files.filter((file) => file.content).map((file) => file.path).slice(0, 100),
    },
    {
      slug: "repository-map",
      title: "Repository map",
      description: "Important source, API, test, documentation, and configuration paths.",
      markdown: categorizedPaths(files),
      sourceFiles: files.map((file) => file.path).slice(0, 100),
    },
  ];
  const development = packageDevelopment(files);
  if (development) {
    pages.push({
      slug: "development",
      title: "Development",
      description: "Runtime requirements, package scripts, and notable dependencies.",
      markdown: development,
      sourceFiles: files.filter((file) => /(?:^|\/)package\.json$/i.test(file.path)).map((file) => file.path),
    });
  }

  return {
    schemaVersion: 1,
    project: { name: snapshot.name, description, accent: "#7467F0" },
    generatedAt: new Date().toISOString(),
    generator: { name: "smolify", model: "deterministic-repository-import-v1" },
    navigation: [{
      label: "Repository",
      items: pages.map((page) => ({ label: page.title, slug: page.slug })),
    }],
    pages,
  };
}

export function parseGithubRepositoryUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname)) {
    throw new Error("Use an https://github.com/owner/repository URL");
  }
  const [owner, rawRepository, ...rest] = url.pathname.split("/").filter(Boolean);
  const repository = rawRepository?.replace(/\.git$/i, "");
  if (!owner || !repository || rest.length) throw new Error("Use the repository root URL");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Invalid GitHub repository URL");
  }
  return { owner, repository, url: `https://github.com/${owner}/${repository}` };
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "smolify-repository-importer",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Repository not found or private. Upload a ZIP for private repositories.");
    if (response.status === 403) throw new Error("GitHub rate limit reached. Try a ZIP upload instead.");
    throw new Error(`GitHub import failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchGithubSnapshot(value: string): Promise<RepositorySnapshot> {
  const parsed = parseGithubRepositoryUrl(value);
  const repository = await githubJson<{
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
    private: boolean;
    html_url: string;
    pushed_at: string;
  }>(`https://api.github.com/repos/${parsed.owner}/${parsed.repository}`);
  if (repository.private) throw new Error("Private GitHub repositories must be uploaded as a ZIP.");

  const tree = await githubJson<{
    truncated: boolean;
    tree: Array<{ path: string; type: "blob" | "tree"; size?: number }>;
  }>(`https://api.github.com/repos/${parsed.owner}/${parsed.repository}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`);
  const blobs = tree.tree
    .filter((entry) => entry.type === "blob" && safePath(entry.path) && TEXT_FILE.test(entry.path))
    .slice(0, 2_000);
  const contentCandidates = blobs
    .filter((entry) => CONTENT_PRIORITY.test(entry.path) && (entry.size ?? 0) <= 400_000)
    .sort((a, b) => Number(/readme/i.test(b.path)) - Number(/readme/i.test(a.path)))
    .slice(0, 24);

  const contents = new Map<string, string>();
  await Promise.all(contentCandidates.map(async (entry) => {
    const rawPath = entry.path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repository}/${encodeURIComponent(repository.default_branch)}/${rawPath}`,
      { headers: { "user-agent": "smolify-repository-importer" } },
    );
    if (!response.ok) return;
    contents.set(entry.path, truncate(await response.text(), 400_000));
  }));

  return {
    name: repository.name,
    description: repository.description ?? `Imported from ${repository.full_name}.`,
    sourceUrl: repository.html_url,
    revision: `${repository.default_branch} · ${repository.pushed_at}`,
    files: blobs.map((entry) => ({ path: entry.path, content: contents.get(entry.path) })),
    totalFiles: tree.tree.filter((entry) => entry.type === "blob").length,
  };
}

export function snapshotFromZip(data: Uint8Array, filename: string): RepositorySnapshot {
  if (data.byteLength > 12 * 1024 * 1024) throw new Error("ZIP archives must be 12 MB or smaller");
  let totalOriginalSize = 0;
  let totalEntries = 0;
  const files = unzipSync(data, {
    filter(info) {
      totalEntries += 1;
      totalOriginalSize += info.originalSize;
      if (totalEntries > 4_000 || totalOriginalSize > 30 * 1024 * 1024) return false;
      return info.originalSize <= 500_000 && safePath(info.name) && TEXT_FILE.test(info.name);
    },
  });
  if (totalEntries > 4_000) throw new Error("ZIP archive contains too many files");
  if (totalOriginalSize > 30 * 1024 * 1024) throw new Error("ZIP expands beyond the 30 MB safety limit");

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let decodedBytes = 0;
  const entries: RepositoryFile[] = [];
  for (const [path, bytes] of Object.entries(files)) {
    if (decodedBytes + bytes.byteLength > 6 * 1024 * 1024) break;
    decodedBytes += bytes.byteLength;
    entries.push({ path, content: decoder.decode(bytes) });
  }
  if (!entries.length) throw new Error("No supported text source files were found in the ZIP");
  const normalized = stripCommonRoot(entries);
  const packageRaw = findContent(normalized, /(?:^|\/)package\.json$/i);
  let packageName = "";
  let packageDescription = "";
  if (packageRaw) {
    try {
      const manifest = JSON.parse(packageRaw) as { name?: string; description?: string };
      packageName = String(manifest.name ?? "");
      packageDescription = String(manifest.description ?? "");
    } catch {
      // A malformed package manifest should not block importing the repository.
    }
  }
  const archiveName = filename.replace(/\.zip$/i, "").replace(/[-_]?(?:main|master)$/i, "");
  return {
    name: (packageName || archiveName || "Uploaded repository").slice(0, 80),
    description: packageDescription || "A privately uploaded repository snapshot.",
    sourceUrl: null,
    revision: "uploaded ZIP snapshot",
    files: normalized,
    totalFiles: totalEntries,
  };
}
