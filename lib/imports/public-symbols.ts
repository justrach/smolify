import {
  assertPublicSourceReadable,
  fetchPublicSourceText,
  normalizedPublicSourcePath,
  publicGithubRepository,
  readPublicSource,
  type PublicSourceProject,
} from "./public-source";
import { analyzeSourceStructure, type SourceDefinition } from "./source-analysis";

const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|rb|rs|go|java|kt|kts|swift|php|cs|c|cc|cpp|h|hpp)$/i;
const LOW_VALUE_PATH = /(?:^|\/)(?:tests?|spec|__tests__|fixtures?|benchmarks?|examples?|generated|\.generated)(?:\/|$)|\.(?:test|spec|stories)\.[^.]+$|\.min\.[^.]+$/i;
const MAX_SCAN_BYTES = 4 * 1024 * 1024;
const LOW_SIGNAL_CALLEES = new Set([
  "URL", "all", "endsWith", "error", "get", "has", "includes", "set",
  "startsWith", "toJSON", "toString",
]);

type TreeBlob = { path: string; type: "blob" | "tree"; size?: number };

export type PublicSymbolOccurrence = {
  symbol: string;
  line: number;
  kind: "declaration" | "import" | "reference";
  sourceUrl: string;
  scopeName: string | null;
  scopeKind: string | null;
  scopeStartLine: number | null;
  scopeEndLine: number | null;
};

export type PublicSymbolFile = {
  path: string;
  matchedSymbols: string[];
  occurrences: PublicSymbolOccurrence[];
  pathScore: number;
};

export type PublicGraphDefinition = SourceDefinition & {
  path: string;
  sourceUrl: string;
};

export type PublicCallEdge = {
  from: string;
  to: string;
  path: string;
  line: number;
  sourceUrl: string;
  scopeKind: string | null;
  scopeStartLine: number | null;
  scopeEndLine: number | null;
};

export type PublicSymbolGraph = {
  definitionCoverage: { matched: string[]; unresolved: string[] };
  definitions: PublicGraphDefinition[];
  callers: PublicCallEdge[];
  callees: PublicCallEdge[];
  connectors: Array<{
    symbol: string;
    paths: Array<{ target: string; symbols: string[] }>;
    reaches: string[];
  }>;
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

function sourceLineUrl(project: PublicSourceProject, path: string, line: number) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${project.sourceUrl}/blob/${project.sourceCommit}/${encodedPath}#L${line}`;
}

function relativeImportCandidates(path: string, module: string) {
  if (!module.startsWith(".")) return [];
  const parts = path.split("/").slice(0, -1);
  for (const part of module.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const base = parts.join("/");
  if (SOURCE_FILE.test(base)) return [base];
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".rs", ".go"];
  return [
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => `${base}/index${extension}`),
  ];
}

function shortestPath(adjacency: Map<string, string[]>, from: string, to: string, maxHops = 4) {
  const queue: string[][] = [[from]];
  const visited = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    if (!path) break;
    if (path.length - 1 >= maxHops) continue;
    for (const next of adjacency.get(path.at(-1) as string) ?? []) {
      const candidate = [...path, next];
      if (next === to) return candidate;
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(candidate);
    }
  }
  return null;
}

function publicGraph(
  requested: string[],
  definitions: PublicGraphDefinition[],
  edges: PublicCallEdge[],
): PublicSymbolGraph {
  const requestedSet = new Set(requested);
  const usefulEdges = edges.filter((edge) =>
    requestedSet.has(edge.to) || !LOW_SIGNAL_CALLEES.has(edge.to),
  );
  const requestedDefinitions = definitions
    .filter((definition) => requestedSet.has(definition.name))
    .sort((left, right) => Number(LOW_VALUE_PATH.test(left.path)) - Number(LOW_VALUE_PATH.test(right.path))
      || left.path.localeCompare(right.path)
      || left.line - right.line)
    .slice(0, 32);
  const adjacency = new Map<string, string[]>();
  for (const edge of usefulEdges) {
    const targets = adjacency.get(edge.from) ?? [];
    if (!targets.includes(edge.to)) targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const connectors = [...adjacency.keys()].map((symbol) => {
    const paths = requested
      .map((target) => ({ target, symbols: shortestPath(adjacency, symbol, target) }))
      .filter((entry): entry is { target: string; symbols: string[] } => Boolean(entry.symbols));
    return { symbol, paths, reaches: paths.map((entry) => entry.target) };
  }).filter((connector) => connector.reaches.length >= 2)
    .sort((left, right) => right.reaches.length - left.reaches.length
      || left.paths.reduce((sum, path) => sum + path.symbols.length, 0)
        - right.paths.reduce((sum, path) => sum + path.symbols.length, 0)
      || left.symbol.localeCompare(right.symbol))
    .slice(0, 6);
  const definitionNames = new Set(requestedDefinitions.map((definition) => definition.name));
  return {
    definitionCoverage: {
      matched: requested.filter((symbol) => definitionNames.has(symbol)),
      unresolved: requested.filter((symbol) => !definitionNames.has(symbol)),
    },
    definitions: requestedDefinitions,
    callers: usefulEdges.filter((edge) => requestedSet.has(edge.to)).slice(0, 48),
    callees: usefulEdges.filter((edge) => requestedSet.has(edge.from)).slice(0, 48),
    connectors,
  };
}

export async function resolvePublicSymbols(
  project: PublicSourceProject,
  symbols: string[],
  options: { maxFiles?: number; maxResults?: number; pathHints?: string[]; includeRelationships?: boolean } = {},
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
  const definitions: PublicGraphDefinition[] = [];
  const edges: PublicCallEdge[] = [];
  const substantivelyMatched = new Set<string>();
  const definitionMatched = new Set<string>();
  let scannedFiles = 0;
  let scannedBytes = 0;
  const scannedPaths = new Set<string>();
  const skippedPaths = new Set<string>();
  const priorityImports: typeof selected = [];
  let hintOffset = 0;
  let genericOffset = hintedCount;
  while (true) {
    const complete = options.includeRelationships
      ? requested.every((symbol) => definitionMatched.has(symbol))
      : requested.every((symbol) => substantivelyMatched.has(symbol));
    if (complete) break;
    let entries: typeof selected;
    if (hintOffset < hintedCount) {
      entries = [selected[hintOffset]];
      hintOffset += 1;
    } else {
      const imported = priorityImports.find((entry) => !scannedPaths.has(entry.path) && !skippedPaths.has(entry.path));
      if (imported) entries = [imported];
      else {
        entries = [];
        while (genericOffset < selected.length && entries.length < 6) {
          const entry = selected[genericOffset];
          genericOffset += 1;
          if (!scannedPaths.has(entry.path) && !skippedPaths.has(entry.path)) entries.push(entry);
        }
      }
    }
    if (!entries.length) break;
    const admitted: typeof selected = [];
    let admittedBytes = scannedBytes;
    for (const entry of entries) {
      const size = entry.size ?? 64_000;
      if (scannedFiles + admitted.length >= maxFiles || admittedBytes + size > MAX_SCAN_BYTES) {
        skippedPaths.add(entry.path);
        continue;
      }
      admitted.push(entry);
      admittedBytes += size;
    }
    entries = admitted;
    if (!entries.length) continue;
    entries.forEach((entry) => scannedPaths.add(entry.path));
    scannedFiles += entries.length;
    scannedBytes += entries.reduce((sum, entry) => sum + (entry.size ?? 64_000), 0);
    const batch = await Promise.all(entries.map(async (entry) => {
      try {
        const source = await fetchPublicSourceText(project, entry.path);
        return { entry, analysis: analyzeSourceStructure(source.content, entry.path, requested) };
      } catch {
        return null;
      }
    }));
    for (const source of batch) {
      if (!source) continue;
      const occurrences: PublicSymbolOccurrence[] = source.analysis.occurrences.map((occurrence) => ({
        ...occurrence,
        sourceUrl: sourceLineUrl(project, source.entry.path, occurrence.line),
      }));
      for (const occurrence of occurrences) {
        if (occurrence.kind !== "import") substantivelyMatched.add(occurrence.symbol);
      }
      for (const definition of source.analysis.definitions.slice(0, 240)) {
        definitions.push({
          ...definition,
          path: source.entry.path,
          sourceUrl: sourceLineUrl(project, source.entry.path, definition.line),
        });
        if (requested.includes(definition.name)) definitionMatched.add(definition.name);
      }
      for (const call of source.analysis.calls.slice(0, 480)) {
        if (!call.scopeName) continue;
        edges.push({
          from: call.scopeName,
          to: call.name,
          path: source.entry.path,
          line: call.line,
          sourceUrl: sourceLineUrl(project, source.entry.path, call.line),
          scopeKind: call.scopeKind,
          scopeStartLine: call.scopeStartLine,
          scopeEndLine: call.scopeEndLine,
        });
      }
      if (options.includeRelationships) {
        for (const imported of source.analysis.imports) {
          if (!requested.includes(imported.symbol)) continue;
          for (const candidate of relativeImportCandidates(source.entry.path, imported.module)) {
            const entry = ranked.find((rankedEntry) => rankedEntry.path === candidate);
            if (entry && !priorityImports.some((item) => item.path === entry.path)) {
              priorityImports.push(entry);
              break;
            }
          }
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
  const matched = new Set(files.flatMap((file) => file.matchedSymbols));
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
    graph: publicGraph(requested, definitions, edges),
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
    includeRelationships: true,
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
