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
const IMPORTED_DOCUMENT = /\.(?:md|mdx)$/i;
const LOW_VALUE_DOCUMENT_PATH = /(?:^|\/)(?:\.i18n|assets?|images?|snippets?|\.generated)(?:\/|$)/i;
const MAX_GITHUB_PATHS = 30_000;
const MAX_GITHUB_DOCUMENTS = 180;
const MAX_GITHUB_CONTENT_BYTES = 8 * 1024 * 1024;

type GithubTreeBlob = { path: string; type: "blob"; size?: number };

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
  if (value.length <= length) return value;
  const marker = "\n\n…truncated by Smolify import.";
  return `${value.slice(0, Math.max(0, length - marker.length))}${marker}`;
}

function safeImportedMarkdown(value: string) {
  return value
    .replace(/<script\b/gi, "&lt;script")
    .replace(/<\/script>/gi, "&lt;/script>")
    .replace(/<iframe\b/gi, "&lt;iframe")
    .replace(/<\/iframe>/gi, "&lt;/iframe>")
    .replace(/javascript:/gi, "javascript&#58;");
}

function balancedTake<T>(items: T[], limit: number, groupFor: (item: T) => string) {
  if (items.length <= limit) return items;
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groupFor(item);
    const bucket = groups.get(group) ?? [];
    bucket.push(item);
    groups.set(group, bucket);
  }
  const selected: T[] = [];
  for (let index = 0; selected.length < limit; index += 1) {
    let added = false;
    for (const bucket of groups.values()) {
      const item = bucket[index];
      if (!item) continue;
      selected.push(item);
      added = true;
      if (selected.length === limit) break;
    }
    if (!added) break;
  }
  return selected;
}

function topLevel(path: string) {
  const [first, second] = cleanPath(path).split("/");
  if (!second) return "root";
  return first || "root";
}

function documentationGroup(path: string) {
  const parts = cleanPath(path).split("/");
  return parts[0]?.toLowerCase() === "docs"
    ? `docs/${parts[1] ?? "root"}`
    : `${parts[0] ?? "root"}/${parts[1] ?? "root"}`;
}

function isImportableDocument(path: string) {
  const normalized = cleanPath(path);
  if (!IMPORTED_DOCUMENT.test(normalized) || LOW_VALUE_DOCUMENT_PATH.test(normalized)) return false;
  const lower = normalized.toLowerCase();
  if (lower === "readme.md" || lower === "readme.mdx" || lower === "changelog.md") return false;
  if (!normalized.includes("/")) return true;
  return /^(?:docs?|guides?|manual)\//i.test(normalized)
    || /^(?:apps?|packages?|extensions?|plugins?|examples?)\/[^/]+\/readme\.(?:md|mdx)$/i.test(normalized);
}

function selectGithubContentCandidates(blobs: GithubTreeBlob[]) {
  const rootPriority = blobs.filter((entry) =>
    !cleanPath(entry.path).includes("/")
    && (CONTENT_PRIORITY.test(entry.path) || isImportableDocument(entry.path))
    && (entry.size ?? 0) <= 400_000,
  );
  const primaryDocuments = blobs
    .filter((entry) =>
      /^(?:docs?|guides?|manual)\//i.test(cleanPath(entry.path))
      && isImportableDocument(entry.path)
      && (entry.size ?? 0) <= 240_000,
    )
    .sort((a, b) => {
      const priority = (path: string) => Number(/(?:^|\/)(?:index|overview|getting-started|quickstart|installation|authentication|configuration|security|api|architecture)\.(?:md|mdx)$/i.test(path));
      return priority(b.path) - priority(a.path) || a.path.localeCompare(b.path);
    });
  const ecosystemDocuments = blobs.filter((entry) =>
    !/^(?:docs?|guides?|manual)\//i.test(cleanPath(entry.path))
    && cleanPath(entry.path).includes("/")
    && isImportableDocument(entry.path)
    && (entry.size ?? 0) <= 240_000,
  );
  const balancedPrimaryDocuments = balancedTake(
    primaryDocuments,
    132,
    (entry) => documentationGroup(entry.path),
  );
  const balancedEcosystemDocuments = balancedTake(
    ecosystemDocuments,
    24,
    (entry) => topLevel(entry.path),
  );
  const selected = new Map<string, GithubTreeBlob>();
  for (const entry of [...rootPriority, ...balancedPrimaryDocuments, ...balancedEcosystemDocuments]) {
    selected.set(entry.path, entry);
  }
  return [...selected.values()];
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
  const allPaths = [...new Set(files.map((file) => file.path).filter(safePath))].sort();
  const paths = balancedTake(allPaths, 500, topLevel);
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

function slugSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/\.(?:md|mdx)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "page";
}

function compactHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function uniquePageSlug(path: string, prefix: string, used: Set<string>) {
  let cleaned = cleanPath(path).replace(/\/(?:readme\.(?:md|mdx))$/i, "");
  if (prefix === "docs") cleaned = cleaned.replace(/^(?:docs?|guides?|manual)\//i, "");
  const parts = cleaned.split("/").filter(Boolean).map(slugSegment);
  let base = `${prefix}/${parts.join("/") || "overview"}`;
  if (base.length > 150) base = `${base.slice(0, 140).replace(/\/$/, "")}-${compactHash(path)}`;
  let candidate = base;
  for (let suffix = 2; used.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
  used.add(candidate);
  return candidate;
}

function plainMarkdown(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function documentFrontmatter(markdown: string) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return { body: markdown, title: "", summary: "" };
  const value = (key: string) => {
    const raw = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
    return raw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2").trim();
  };
  return {
    body: markdown.slice(match[0].length),
    title: value("title"),
    summary: value("summary"),
  };
}

function documentTitle(path: string, markdown: string) {
  const parsed = documentFrontmatter(markdown);
  if (parsed.title) return truncate(plainMarkdown(parsed.title), 120);
  const withoutCodeFences = parsed.body.replace(/```[\s\S]*?```/g, "");
  const heading = withoutCodeFences.match(/^#\s+(.+)$/m)?.[1];
  if (heading) return truncate(plainMarkdown(heading), 120);
  const name = cleanPath(path).split("/").at(-1)?.replace(/\.(?:md|mdx)$/i, "") ?? "Documentation";
  return truncate(name.split(/[-_]+/).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" "), 120);
}

function documentDescription(path: string, markdown: string) {
  const parsed = documentFrontmatter(markdown);
  if (parsed.summary) return truncate(plainMarkdown(parsed.summary), 240);
  const paragraph = parsed.body
    .split(/\n\s*\n/)
    .map(plainMarkdown)
    .find((value) => value.length >= 24 && !/^https?:\/\//i.test(value));
  return truncate(paragraph || `Repository documentation imported from ${path}.`, 240);
}

function documentationPages(files: RepositoryFile[], used: Set<string>) {
  return files
    .filter((file) => file.content && isImportableDocument(file.path))
    .slice(0, MAX_GITHUB_DOCUMENTS)
    .map((file): DocsPage => {
      const markdown = file.content ?? "";
      const body = documentFrontmatter(markdown).body.trim() || markdown;
      return {
        slug: uniquePageSlug(file.path, "docs", used),
        title: documentTitle(file.path, markdown),
        description: documentDescription(file.path, markdown),
        markdown: truncate(`${body}\n\n---\n\n_Source: \`${file.path.replace(/`/g, "\\`")}\`_`, 240_000),
        sourceFiles: [file.path],
      };
    });
}

function fileIndexPages(files: RepositoryFile[], used: Set<string>) {
  const groups = new Map<string, string[]>();
  for (const path of [...new Set(files.map((file) => cleanPath(file.path)).filter(safePath))].sort()) {
    const group = topLevel(path);
    const paths = groups.get(group) ?? [];
    paths.push(path);
    groups.set(group, paths);
  }
  const pages: DocsPage[] = [];
  for (const [group, paths] of groups) {
    const pageCount = Math.ceil(paths.length / 650);
    for (let offset = 0; offset < paths.length && pages.length < 120; offset += 650) {
      const chunk = paths.slice(offset, offset + 650);
      const pageNumber = Math.floor(offset / 650) + 1;
      const label = group === "root" ? "Repository root" : group;
      const suffix = pageCount > 1 ? ` (${pageNumber}/${pageCount})` : "";
      const virtualPath = `${group}${pageCount > 1 ? `-${pageNumber}` : ""}`;
      pages.push({
        slug: uniquePageSlug(virtualPath, "files", used),
        title: truncate(`Files: ${label}${suffix}`, 120),
        description: `${chunk.length} indexed repository paths from ${label}.`,
        markdown: truncate([
          `# ${label} files${suffix}`,
          "",
          `This index covers ${chunk.length} source-grounded paths. Search matches file and directory names through D1 FTS5/BM25.`,
          "",
          ...chunk.map((path) => `- \`${path.replace(/`/g, "\\`")}\``),
        ].join("\n"), 240_000),
        sourceFiles: chunk.slice(0, 100),
      });
    }
  }
  return pages;
}

function navigationGroup(label: string, pages: DocsPage[]) {
  return {
    label,
    items: pages.map((page) => ({ label: page.title, slug: page.slug })),
  };
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

  const corePages: DocsPage[] = [
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
    corePages.push({
      slug: "development",
      title: "Development",
      description: "Runtime requirements, package scripts, and notable dependencies.",
      markdown: development,
      sourceFiles: files
        .filter((file) => /(?:^|\/)package\.json$/i.test(file.path))
        .map((file) => file.path)
        .slice(0, 100),
    });
  }
  const used = new Set(corePages.map((page) => page.slug));
  const importedPages = documentationPages(files, used);
  const indexedFilePages = fileIndexPages(files, used);
  const pages = [...corePages, ...importedPages, ...indexedFilePages].map((page) => ({
    ...page,
    markdown: safeImportedMarkdown(page.markdown),
  }));
  const navigation = [navigationGroup("Repository", corePages)];
  for (let offset = 0; offset < importedPages.length; offset += 100) {
    navigation.push(navigationGroup(
      importedPages.length > 100 ? `Repository docs ${Math.floor(offset / 100) + 1}` : "Repository docs",
      importedPages.slice(offset, offset + 100),
    ));
  }
  for (let offset = 0; offset < indexedFilePages.length; offset += 100) {
    navigation.push(navigationGroup(
      indexedFilePages.length > 100 ? `File index ${Math.floor(offset / 100) + 1}` : "File index",
      indexedFilePages.slice(offset, offset + 100),
    ));
  }

  return {
    schemaVersion: 1,
    project: { name: snapshot.name, description, accent: "#7467F0" },
    generatedAt: new Date().toISOString(),
    generator: { name: "smolify", model: "deterministic-repository-import-v1" },
    navigation,
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
  const allBlobs = tree.tree
    .filter((entry): entry is GithubTreeBlob => entry.type === "blob" && safePath(entry.path) && TEXT_FILE.test(entry.path));
  const blobs = balancedTake(allBlobs, MAX_GITHUB_PATHS, (entry) => topLevel(entry.path));
  const contentCandidates = selectGithubContentCandidates(allBlobs);

  const contents = new Map<string, string>();
  let remainingContentBytes = MAX_GITHUB_CONTENT_BYTES;
  for (let offset = 0; offset < contentCandidates.length && remainingContentBytes > 0; offset += 8) {
    const batch = await Promise.all(contentCandidates.slice(offset, offset + 8).map(async (entry) => {
      const rawPath = entry.path.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(
        `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repository}/${encodeURIComponent(repository.default_branch)}/${rawPath}`,
        { headers: { "user-agent": "smolify-repository-importer" } },
      );
      if (!response.ok) return null;
      return { path: entry.path, bytes: new Uint8Array(await response.arrayBuffer()) };
    }));
    for (const result of batch) {
      if (!result || result.bytes.byteLength > remainingContentBytes) continue;
      remainingContentBytes -= result.bytes.byteLength;
      contents.set(result.path, truncate(new TextDecoder().decode(result.bytes), 400_000));
    }
  }

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
