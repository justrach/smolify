import type { AccessibleProject } from "@/lib/projects/access";

const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|rb|rs|go|java|kt|kts|swift|php|cs|c|cc|cpp|h|hpp)$/i;
const BLOCKED_PATH = /(?:^|\/)(?:\.git|node_modules|vendor|dist|build|coverage|\.next|\.open-next|target|__pycache__)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|credentials?|secrets?|id_rsa|id_ed25519|\.npmrc)$|\.(?:pem|key|p12|pfx|keystore)$/i;
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_SOURCE_LINES = 200;
const MAX_SOURCE_CHARS = 40_000;

export type PublicSourceProject = Pick<
  AccessibleProject,
  "sourceType" | "sourceUrl" | "sourceCommit" | "sourceRetention"
>;

export type PublicSourceRead = {
  path: string;
  commit: string;
  sourceUrl: string;
  requestedRange: { startLine: number; endLine: number };
  returnedRange: { startLine: number; endLine: number };
  totalLines: number;
  content: string;
  truncated: boolean;
};

export function normalizedPublicSourcePath(value: string) {
  const path = value.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (!path || /[\u0000-\u001f\u007f]/.test(path) || path.split("/").includes("..") || BLOCKED_PATH.test(path) || !SOURCE_FILE.test(path)) {
    throw new Error("Only safe source-code paths from the imported public repository may be read");
  }
  return path;
}

export function publicGithubRepository(sourceUrl: string | null) {
  if (!sourceUrl) throw new Error("This project does not have a public GitHub source URL");
  const url = new URL(sourceUrl);
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2) {
    throw new Error("Public source reads require a GitHub repository root URL");
  }
  return { owner: parts[0], repository: parts[1].replace(/\.git$/i, "") };
}

export function assertPublicSourceReadable(project: PublicSourceProject) {
  if (project.sourceType !== "github" || project.sourceRetention !== "public-symbols") {
    throw new Error("Raw source reads are disabled for private, uploaded, and metadata-only projects");
  }
  if (!project.sourceCommit || !/^[a-f0-9]{40}$/i.test(project.sourceCommit)) {
    throw new Error("This project does not have a commit-pinned public source snapshot");
  }
}

async function boundedBody(response: Response) {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Source file exceeds Smolify's 512 KB read limit");
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Source file exceeds Smolify's 512 KB read limit");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Source file exceeds Smolify's 512 KB read limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readPublicSource(
  project: PublicSourceProject,
  input: { path: string; startLine: number; endLine: number },
): Promise<PublicSourceRead> {
  assertPublicSourceReadable(project);
  if (!Number.isInteger(input.startLine) || !Number.isInteger(input.endLine) || input.startLine < 1) {
    throw new Error("Source line ranges must use positive integers");
  }
  if (input.endLine < input.startLine || input.endLine - input.startLine + 1 > MAX_SOURCE_LINES) {
    throw new Error(`Public source reads are limited to ${MAX_SOURCE_LINES} consecutive lines`);
  }

  const source = await fetchPublicSourceText(project, input.path);
  const { path } = source;
  const content = source.content;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const lines = content.split(/\r?\n/);
  if (input.startLine > lines.length) throw new Error(`Source file has only ${lines.length} lines`);
  const requestedEnd = Math.min(input.endLine, lines.length);
  const selected: string[] = [];
  let returnedEnd = input.startLine - 1;
  let usedCharacters = 0;
  let partialLine = false;
  for (let line = input.startLine; line <= requestedEnd; line += 1) {
    const value = lines[line - 1];
    const separatorLength = selected.length ? 1 : 0;
    const remaining = MAX_SOURCE_CHARS - usedCharacters - separatorLength;
    if (remaining <= 0) break;
    if (value.length > remaining) {
      selected.push(value.slice(0, remaining));
      returnedEnd = line;
      partialLine = true;
      break;
    }
    selected.push(value);
    usedCharacters += value.length + separatorLength;
    returnedEnd = line;
  }
  const sourceUrl = `${project.sourceUrl}/blob/${project.sourceCommit}/${encodedPath}#L${input.startLine}-L${returnedEnd}`;
  return {
    path,
    commit: project.sourceCommit as string,
    sourceUrl,
    requestedRange: { startLine: input.startLine, endLine: input.endLine },
    returnedRange: { startLine: input.startLine, endLine: returnedEnd },
    totalLines: lines.length,
    content: selected.join("\n"),
    truncated: partialLine || returnedEnd < input.endLine,
  };
}

export async function fetchPublicSourceText(project: PublicSourceProject, inputPath: string) {
  assertPublicSourceReadable(project);
  const path = normalizedPublicSourcePath(inputPath);
  const repository = publicGithubRepository(project.sourceUrl);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/${project.sourceCommit}/${encodedPath}`;
  const response = await fetch(rawUrl, {
    headers: { "user-agent": "smolify-public-source-reader" },
    // Workerd supports manual redirect handling, not the browser-only `error`
    // mode. Keep redirects disabled so a repository path can never move the
    // bounded reader to another origin.
    redirect: "manual",
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Source path was not found at the imported commit" : `Public source read failed (${response.status})`);
  const content = new TextDecoder("utf-8", { fatal: false }).decode(await boundedBody(response));
  return { path, content };
}
