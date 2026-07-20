import type { PublicSymbolGraph } from "../imports/public-symbols";

export type PublicSourceEvidenceItem = {
  path: string;
  symbols: string[];
  sourceUrl: string;
  returnedRange: { startLine: number; endLine: number };
  content: string;
  truncated: boolean;
};

function payloadLength(graph: PublicSymbolGraph, evidence: PublicSourceEvidenceItem[]) {
  return JSON.stringify({ graph, evidence }).length;
}

function safePrefix(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) return value;
  let prefix = value.slice(0, Math.max(0, maxCharacters));
  const last = prefix.charCodeAt(prefix.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) prefix = prefix.slice(0, -1);
  return prefix;
}

function withContent(item: PublicSourceEvidenceItem, content: string): PublicSourceEvidenceItem {
  const endLine = item.returnedRange.startLine + (content.match(/\n/g)?.length ?? 0);
  return {
    ...item,
    content,
    returnedRange: { ...item.returnedRange, endLine },
    sourceUrl: item.sourceUrl.replace(
      /#L\d+-L\d+$/,
      `#L${item.returnedRange.startLine}-L${endLine}`,
    ),
    truncated: item.truncated || content.length < item.content.length,
  };
}

function maximumEvidencePrefix(
  graph: PublicSymbolGraph,
  evidence: PublicSourceEvidenceItem[],
  item: PublicSourceEvidenceItem,
  maxCharacters: number,
  contentLimit: number,
) {
  let low = 0;
  let high = Math.min(item.content.length, Math.max(0, contentLimit));
  let accepted: PublicSourceEvidenceItem | null = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = withContent(item, safePrefix(item.content, middle));
    if (payloadLength(graph, [...evidence, candidate]) <= maxCharacters) {
      accepted = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return accepted?.content.length ? accepted : null;
}

/** Admit source graph sections and excerpts under one hard serialized cap. */
export function packPublicSourceContext(
  sourceGraph: PublicSymbolGraph,
  sourceEvidence: PublicSourceEvidenceItem[],
  maxCharacters: number,
) {
  const graph: PublicSymbolGraph = {
    definitionCoverage: { matched: [], unresolved: [] },
    definitions: [],
    callers: [],
    callees: [],
    connectors: [],
  };
  const evidence: PublicSourceEvidenceItem[] = [];
  const cap = Math.max(0, maxCharacters);
  const graphCap = Math.max(payloadLength(graph, evidence), Math.floor(cap * 0.55));
  const tryMutation = (mutate: () => void, rollback: () => void) => {
    mutate();
    if (payloadLength(graph, evidence) <= graphCap) return true;
    rollback();
    return false;
  };

  let graphAdmissionOpen = true;
  for (const symbol of sourceGraph.definitionCoverage.matched) {
    graphAdmissionOpen = graphAdmissionOpen && tryMutation(
      () => graph.definitionCoverage.matched.push(symbol),
      () => { graph.definitionCoverage.matched.pop(); },
    );
  }
  for (const symbol of sourceGraph.definitionCoverage.unresolved) {
    graphAdmissionOpen = graphAdmissionOpen && tryMutation(
      () => graph.definitionCoverage.unresolved.push(symbol),
      () => { graph.definitionCoverage.unresolved.pop(); },
    );
  }

  const admit = <T>(target: T[], values: T[]) => {
    for (const value of values) {
      if (!graphAdmissionOpen) return;
      graphAdmissionOpen = tryMutation(
        () => target.push(value),
        () => { target.pop(); },
      );
    }
  };
  admit(graph.definitions, sourceGraph.definitions);
  admit(graph.connectors, sourceGraph.connectors);
  admit(graph.callers, sourceGraph.callers);
  admit(graph.callees, sourceGraph.callees);

  for (let index = 0; index < sourceEvidence.length; index += 1) {
    const remainingItems = sourceEvidence.length - index;
    const remainingCharacters = Math.max(0, cap - payloadLength(graph, evidence));
    const fairContentLimit = Math.floor(remainingCharacters / remainingItems);
    const item = maximumEvidencePrefix(
      graph,
      evidence,
      sourceEvidence[index],
      cap,
      fairContentLimit,
    );
    if (item) evidence.push(item);
  }

  const charactersUsed = payloadLength(graph, evidence);
  return {
    graph,
    evidence,
    charactersUsed,
    truncated: charactersUsed < payloadLength(sourceGraph, sourceEvidence),
  };
}
