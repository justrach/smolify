import {
  assertPublicSourceReadable,
  fetchPublicSourceText,
  normalizedPublicSourcePath,
  publicGithubRepository,
  readPublicSource,
  type PublicSourceProject,
} from "./public-source";

const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|rb|rs|go|java|kt|kts|swift|php|cs|c|cc|cpp|h|hpp)$/i;
const LOW_VALUE_PATH = /(?:^|\/)(?:tests?|spec|__tests__|fixtures?|benchmarks?|examples?|generated|\.generated)(?:\/|$)|\.(?:test|spec|stories)\.[^.]+$|\.min\.[^.]+$/i;
const MAX_SCAN_BYTES = 4 * 1024 * 1024;

type TreeBlob = { path: string; type: "blob" | "tree"; size?: number };

export type PublicSymbolOccurrence = {
  symbol: string;
  line: number;
  kind: "declaration" | "import" | "reference";
  sourceUrl: string;
};

export type PublicSymbolFile = {
  path: string;
  matchedSymbols: string[];
  occurrences: PublicSymbolOccurrence[];
  pathScore: number;
};

function githubHeaders(accessToken?: string) {
  return {
    accept: "application/vnd.github+json",
    "user-agent": "smolify-public-symbol-resolver",
    "x-github-api-version": "2022-11-28",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function githubJson<T>(url: string, accessToken?: string) {
  const response = await fetch(url, { headers: githubHeaders(accessToken), redirect: "error" });
  if (!response.ok) throw new Error(`Public symbol resolution failed (${response.status})`);
  return response.json() as Promise<T>;
}

function identifierWords(identifier: string) {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_$./:-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function stem(word: string) {
  return word
    .replace(/(?:ations?|itions?)$/, "")
    .replace(/(?:ing|ers?|ed|ies|s)$/, "")
    .slice(0, 12);
}

function pathScore(path: string, symbols: string[]) {
  const normalized = path.toLowerCase();
  const filename = normalized.split("/").at(-1)?.replace(SOURCE_FILE, "") ?? "";
  let score = LOW_VALUE_PATH.test(normalized) ? -120 : 0;
  if (/(?:^|\/)(?:src|app|lib|server|client|components?)(?:\/|$)/.test(normalized)) score += 20;
  for (const symbol of symbols) {
    if (normalized.includes(symbol.toLowerCase())) score += 500;
    for (const word of identifierWords(symbol)) {
      const wordStem = stem(word);
      if (wordStem.length < 4) continue;
      if (stem(filename).includes(wordStem) || wordStem.includes(stem(filename))) score += 90;
      else if (normalized.includes(wordStem)) score += 35;
    }
  }
  return score - normalized.split("/").length;
}

function safeCandidate(path: string) {
  if (!SOURCE_FILE.test(path)) return false;
  try {
    normalizedPublicSourcePath(path);
    return true;
  } catch {
    return false;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function occurrenceKind(line: string, symbol: string): PublicSymbolOccurrence["kind"] | null {
  const trimmed = line.trim();
  if (!trimmed || /^(?:\/\/|#|\*|\/\*)/.test(trimmed)) return null;
  const escaped = escapeRegex(symbol);
  if (/\b(?:import|from|require)\b/.test(line)) return "import";
  const declaration = new RegExp(
    `(?:\\b(?:function|class|interface|type|enum|struct|trait|def|fn)\\s+${escaped}\\b|\\b(?:const|let|var|static)\\s+${escaped}\\b|\\bfunc\\s+(?:\\([^)]*\\)\\s*)?${escaped}\\b)`,
  );
  return declaration.test(line) ? "declaration" : "reference";
}

function sourceLineUrl(project: PublicSourceProject, path: string, line: number) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${project.sourceUrl}/blob/${project.sourceCommit}/${encodedPath}#L${line}`;
}

export async function resolvePublicSymbols(
  project: PublicSourceProject,
  symbols: string[],
  options: { maxFiles?: number; maxResults?: number; pathHints?: string[] } = {},
  accessToken?: string,
) {
  assertPublicSourceReadable(project);
  const requested = [...new Set(symbols.map((symbol) => symbol.trim()).filter((symbol) =>
    /^[A-Za-z_$][\w$]{2,120}$/.test(symbol),
  ))].slice(0, 8);
  if (!requested.length) throw new Error("Provide at least one code identifier to resolve");
  const repository = publicGithubRepository(project.sourceUrl);
  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
  const commit = await githubJson<{ tree: { sha: string } }>(
    `${apiRoot}/git/commits/${project.sourceCommit}`,
    accessToken,
  );
  const tree = await githubJson<{ truncated: boolean; tree: TreeBlob[] }>(
    `${apiRoot}/git/trees/${commit.tree.sha}?recursive=1`,
    accessToken,
  );
  const ranked = tree.tree
    .filter((entry) => entry.type === "blob" && (entry.size ?? 0) <= 512 * 1024 && safeCandidate(entry.path))
    .map((entry) => ({ ...entry, score: pathScore(entry.path, requested) }))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));

  const perSymbolRankings = requested.map((symbol) => ranked
      .map((entry) => ({ entry, score: pathScore(entry.path, [symbol]) }))
      .sort((left, right) => right.score - left.score || left.entry.path.localeCompare(right.entry.path))
      .slice(0, 48)
      .map(({ entry }) => entry));
  const maxFiles = Math.min(options.maxFiles ?? 96, 96);
  const selected: typeof ranked = [];
  const selectedPaths = new Set<string>();
  let selectedBudgetBytes = 0;
  const addSelected = (entry: (typeof ranked)[number] | undefined) => {
    if (!entry || selectedPaths.has(entry.path) || selected.length >= maxFiles) return;
    const size = entry.size ?? 64_000;
    if (selectedBudgetBytes + size > MAX_SCAN_BYTES) return;
    selected.push(entry);
    selectedPaths.add(entry.path);
    selectedBudgetBytes += size;
  };
  for (const hint of (options.pathHints ?? []).slice(0, 20)) {
    let normalized: string;
    try {
      normalized = normalizedPublicSourcePath(hint);
    } catch {
      continue;
    }
    addSelected(ranked.find((entry) => entry.path === normalized));
  }
  const hintedCount = selected.length;
  for (let rank = 0; rank < 48 && selected.length < maxFiles; rank += 1) {
    for (const candidates of perSymbolRankings) {
      addSelected(candidates[rank]);
      if (selected.length >= maxFiles) break;
    }
  }

  const files: PublicSymbolFile[] = [];
  const substantivelyMatched = new Set<string>();
  let scannedFiles = 0;
  let scannedBytes = 0;
  const batches: Array<typeof selected> = [
    ...selected.slice(0, hintedCount).map((entry) => [entry]),
  ];
  for (let offset = hintedCount; offset < selected.length; offset += 6) {
    batches.push(selected.slice(offset, offset + 6));
  }
  for (const entries of batches) {
    if (requested.every((symbol) => substantivelyMatched.has(symbol))) break;
    scannedFiles += entries.length;
    scannedBytes += entries.reduce((sum, entry) => sum + (entry.size ?? 64_000), 0);
    const batch = await Promise.all(entries.map(async (entry) => {
      try {
        const source = await fetchPublicSourceText(project, entry.path);
        return { entry, lines: source.content.split(/\r?\n/) };
      } catch {
        return null;
      }
    }));
    for (const source of batch) {
      if (!source) continue;
      const occurrences: PublicSymbolOccurrence[] = [];
      for (const symbol of requested) {
        const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\b`);
        let symbolMatches = 0;
        for (let index = 0; index < source.lines.length && symbolMatches < 12; index += 1) {
          if (!pattern.test(source.lines[index])) continue;
          const kind = occurrenceKind(source.lines[index], symbol);
          if (!kind) continue;
          occurrences.push({
            symbol,
            line: index + 1,
            kind,
            sourceUrl: sourceLineUrl(project, source.entry.path, index + 1),
          });
          if (kind !== "import") substantivelyMatched.add(symbol);
          symbolMatches += 1;
        }
      }
      if (!occurrences.length) continue;
      files.push({
        path: source.entry.path,
        matchedSymbols: [...new Set(occurrences.map((occurrence) => occurrence.symbol))],
        occurrences,
        pathScore: source.entry.score,
      });
    }
  }
  files.sort((left, right) =>
    right.matchedSymbols.length - left.matchedSymbols.length
    || right.occurrences.filter((occurrence) => occurrence.kind === "declaration").length
      - left.occurrences.filter((occurrence) => occurrence.kind === "declaration").length
    || right.pathScore - left.pathScore
    || left.path.localeCompare(right.path));
  const maxResults = Math.min(options.maxResults ?? 8, 20);
  const returnedFiles = files.slice(0, maxResults);
  const matched = new Set(returnedFiles.flatMap((file) => file.matchedSymbols));
  return {
    commit: project.sourceCommit as string,
    requested,
    matched: requested.filter((symbol) => matched.has(symbol)),
    unresolved: requested.filter((symbol) => !matched.has(symbol)),
    treeTruncated: tree.truncated,
    candidateFiles: ranked.length,
    scannedFiles,
    scannedBytes,
    files: returnedFiles,
  };
}

export async function buildPublicSourceEvidence(
  project: PublicSourceProject,
  symbols: string[],
  options: { maxCharacters: number; maxFiles?: number; pathHints?: string[] } = { maxCharacters: 8_000 },
  accessToken?: string,
) {
  const resolution = await resolvePublicSymbols(project, symbols, {
    maxFiles: options.maxFiles,
    maxResults: 8,
    pathHints: options.pathHints,
  }, accessToken);
  const clusters: Array<{
    path: string;
    startLine: number;
    endLine: number;
    symbols: string[];
    score: number;
  }> = [];
  for (const file of resolution.files) {
    const occurrences = [...file.occurrences].sort((left, right) => left.line - right.line);
    let group: PublicSymbolOccurrence[] = [];
    const flush = () => {
      if (!group.length) return;
      const substantive = group.filter((occurrence) => occurrence.kind !== "import");
      if (!substantive.length) {
        group = [];
        return;
      }
      const unique = [...new Set(substantive.map((occurrence) => occurrence.symbol))];
      const firstLine = substantive[0].line;
      const lastLine = substantive.at(-1)?.line ?? firstLine;
      const startLine = Math.max(1, firstLine - 10);
      clusters.push({
        path: file.path,
        startLine,
        endLine: Math.min(startLine + 199, lastLine + 30),
        symbols: unique,
        score: unique.length * 100
          + substantive.filter((occurrence) => occurrence.kind === "declaration").length * 20
          + substantive.filter((occurrence) => occurrence.kind === "reference").length * 10
          + file.matchedSymbols.length * 10,
      });
      group = [];
    };
    for (const occurrence of occurrences) {
      if (group.length && occurrence.line - group[0].line > 80) flush();
      group.push(occurrence);
    }
    flush();
  }
  clusters.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  const evidence = [];
  let remaining = Math.max(0, options.maxCharacters);
  const selectedClusters: typeof clusters = [];
  const remainingClusters = [...clusters];
  const coveredSymbols = new Set<string>();
  while (selectedClusters.length < 2 && remainingClusters.length) {
    remainingClusters.sort((left, right) => {
      const leftNewSymbols = left.symbols.filter((symbol) => !coveredSymbols.has(symbol)).length;
      const rightNewSymbols = right.symbols.filter((symbol) => !coveredSymbols.has(symbol)).length;
      return rightNewSymbols - leftNewSymbols
        || right.score - left.score
        || left.path.localeCompare(right.path);
    });
    const selected = remainingClusters.shift();
    if (!selected) break;
    selectedClusters.push(selected);
    selected.symbols.forEach((symbol) => coveredSymbols.add(symbol));
  }
  for (let index = 0; index < selectedClusters.length; index += 1) {
    const cluster = selectedClusters[index];
    if (remaining < 300) break;
    const read = await readPublicSource(project, cluster);
    const quota = index === 0 && selectedClusters.length > 1
      ? Math.max(300, Math.min(remaining, Math.floor(options.maxCharacters * 0.65)))
      : remaining;
    const content = read.content.slice(0, quota);
    const returnedEndLine = read.returnedRange.startLine
      + (content.match(/\n/g)?.length ?? 0);
    const sourceUrl = read.sourceUrl.replace(/#L\d+-L\d+$/, `#L${read.returnedRange.startLine}-L${returnedEndLine}`);
    evidence.push({
      path: cluster.path,
      symbols: cluster.symbols,
      sourceUrl,
      returnedRange: { startLine: read.returnedRange.startLine, endLine: returnedEndLine },
      content,
      truncated: read.truncated || content.length < read.content.length,
    });
    remaining -= content.length;
  }
  return { resolution, evidence };
}
