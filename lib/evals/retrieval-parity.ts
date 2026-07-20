type GraphEdge = { from: string; to: string; path: string; line: number; sourceUrl: string };

export type SourceParityEvidence = {
  resolution: {
    commit: string;
    requested: string[];
    matched: string[];
    unresolved: string[];
    scannedFiles: number;
    scannedBytes: number;
    graph: {
      definitionCoverage: { matched: string[]; unresolved: string[] };
      definitions: Array<{ name: string; path: string; line: number; sourceUrl: string }>;
      callers: GraphEdge[];
      callees: GraphEdge[];
      connectors: Array<{ symbol: string; reaches: string[]; paths: Array<{ target: string; symbols: string[] }> }>;
    };
  };
  evidence: Array<{ path: string; symbols: string[]; sourceUrl: string; content: string }>;
};

export type SourceParityScenario = {
  id: string;
  requiredSymbols: string[];
  requiredDefinitionPaths?: Record<string, string>;
  requiredEdges?: Array<{ from: string; to: string }>;
  requiredConnector?: { symbol: string; reaches: string[] };
  requiredEvidenceTerms?: string[];
  maxScannedFiles: number;
  maxScannedBytes: number;
  maxEvidenceCharacters: number;
};

export type ContextParityEvidence = {
  strategy: { embeddings: boolean; answerModel: boolean; facets: string[] };
  pages: Array<{ slug: string; retrieval: string; matchedFacets: string[] }>;
  approximateTokensUsed: number;
  synthesisRequired: boolean;
};

export type ContextParityScenario = {
  id: string;
  requiredPageSlugs: string[];
  requiredFacets: string[];
  maxTokens: number;
};

export type ParityCheck = {
  id: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};

function summarize(id: string, checks: ParityCheck[]) {
  const passed = checks.filter((check) => check.passed).length;
  return {
    id,
    passed: passed === checks.length,
    score: checks.length ? passed / checks.length : 0,
    passedChecks: passed,
    totalChecks: checks.length,
    checks,
  };
}

export function evaluateSourceParity(evidence: SourceParityEvidence, scenario: SourceParityScenario) {
  const graphEdges = [...evidence.resolution.graph.callers, ...evidence.resolution.graph.callees];
  const edgeSet = new Set(graphEdges.map((edge) => `${edge.from}->${edge.to}`));
  const definitionPaths = new Map(evidence.resolution.graph.definitions.map((definition) => [definition.name, definition.path]));
  const evidenceText = evidence.evidence.map((item) => item.content).join("\n");
  const sourceUrls = [
    ...evidence.resolution.graph.definitions.map((definition) => definition.sourceUrl),
    ...graphEdges.map((edge) => edge.sourceUrl),
    ...evidence.evidence.map((item) => item.sourceUrl),
  ];
  const expectedUnresolved = evidence.resolution.requested.filter((symbol) => !evidence.resolution.matched.includes(symbol));
  const checks: ParityCheck[] = [
    {
      id: "identifier_recall",
      passed: scenario.requiredSymbols.every((symbol) => evidence.resolution.matched.includes(symbol)),
      expected: scenario.requiredSymbols,
      actual: evidence.resolution.matched,
    },
    {
      id: "definition_recall",
      passed: scenario.requiredSymbols.every((symbol) => evidence.resolution.graph.definitionCoverage.matched.includes(symbol)),
      expected: scenario.requiredSymbols,
      actual: evidence.resolution.graph.definitionCoverage.matched,
    },
    {
      id: "explicit_unresolved",
      passed: expectedUnresolved.every((symbol) => evidence.resolution.unresolved.includes(symbol)),
      expected: expectedUnresolved,
      actual: evidence.resolution.unresolved,
    },
    {
      id: "pinned_provenance",
      passed: sourceUrls.length > 0 && sourceUrls.every((url) => url.includes(`/blob/${evidence.resolution.commit}/`)),
      expected: evidence.resolution.commit,
      actual: sourceUrls,
    },
    {
      id: "scan_budget",
      passed: evidence.resolution.scannedFiles <= scenario.maxScannedFiles
        && evidence.resolution.scannedBytes <= scenario.maxScannedBytes,
      expected: { files: scenario.maxScannedFiles, bytes: scenario.maxScannedBytes },
      actual: { files: evidence.resolution.scannedFiles, bytes: evidence.resolution.scannedBytes },
    },
    {
      id: "evidence_budget",
      passed: evidence.evidence.reduce((sum, item) => sum + item.content.length, 0) <= scenario.maxEvidenceCharacters,
      expected: scenario.maxEvidenceCharacters,
      actual: evidence.evidence.reduce((sum, item) => sum + item.content.length, 0),
    },
  ];
  if (scenario.requiredDefinitionPaths) {
    checks.push({
      id: "definition_paths",
      passed: Object.entries(scenario.requiredDefinitionPaths).every(([symbol, path]) => definitionPaths.get(symbol) === path),
      expected: scenario.requiredDefinitionPaths,
      actual: Object.fromEntries(definitionPaths),
    });
  }
  if (scenario.requiredEdges) {
    checks.push({
      id: "relationship_recall",
      passed: scenario.requiredEdges.every((edge) => edgeSet.has(`${edge.from}->${edge.to}`)),
      expected: scenario.requiredEdges,
      actual: [...edgeSet],
    });
  }
  if (scenario.requiredConnector) {
    const connector = evidence.resolution.graph.connectors.find((entry) => entry.symbol === scenario.requiredConnector?.symbol);
    checks.push({
      id: "connector_recall",
      passed: Boolean(connector && scenario.requiredConnector.reaches.every((symbol) => connector.reaches.includes(symbol))),
      expected: scenario.requiredConnector,
      actual: connector ?? null,
    });
  }
  if (scenario.requiredEvidenceTerms) {
    checks.push({
      id: "source_evidence_recall",
      passed: scenario.requiredEvidenceTerms.every((term) => evidenceText.includes(term)),
      expected: scenario.requiredEvidenceTerms,
      actual: evidence.evidence.map((item) => ({ path: item.path, symbols: item.symbols })),
    });
  }
  return summarize(scenario.id, checks);
}

export function evaluateContextParity(evidence: ContextParityEvidence, scenario: ContextParityScenario) {
  const pageSlugs = evidence.pages.map((page) => page.slug);
  const checks: ParityCheck[] = [
    {
      id: "deterministic_retrieval",
      passed: evidence.strategy.embeddings === false && evidence.strategy.answerModel === false,
      expected: { embeddings: false, answerModel: false },
      actual: { embeddings: evidence.strategy.embeddings, answerModel: evidence.strategy.answerModel },
    },
    {
      id: "page_recall",
      passed: scenario.requiredPageSlugs.every((slug) => pageSlugs.includes(slug)),
      expected: scenario.requiredPageSlugs,
      actual: pageSlugs,
    },
    {
      id: "facet_recall",
      passed: scenario.requiredFacets.every((facet) => evidence.strategy.facets.includes(facet)),
      expected: scenario.requiredFacets,
      actual: evidence.strategy.facets,
    },
    {
      id: "token_budget",
      passed: evidence.approximateTokensUsed <= scenario.maxTokens,
      expected: scenario.maxTokens,
      actual: evidence.approximateTokensUsed,
    },
    {
      id: "agent_synthesis_boundary",
      passed: evidence.synthesisRequired,
      expected: true,
      actual: evidence.synthesisRequired,
    },
  ];
  return summarize(scenario.id, checks);
}
