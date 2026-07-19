import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { DocsPage } from "./schema";

type SyntaxNode = {
  type: string;
  value?: string;
  children?: SyntaxNode[];
};

function textOf(node: SyntaxNode): string {
  if (typeof node.value === "string") return node.value;
  return node.children?.map(textOf).join(" ") ?? "";
}

function identifierAliases(value: string): string[] {
  const split = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./:$-]+/g, " ")
    .toLowerCase();
  return [value.toLowerCase(), split];
}

export type SearchablePage = {
  headings: string;
  symbols: string;
  bodyText: string;
  sourceFiles: string;
};

export function pageToSearchDocument(page: DocsPage): SearchablePage {
  const tree = unified().use(remarkParse).parse(page.markdown) as SyntaxNode;
  const headings: string[] = [];
  const body: string[] = [];
  const symbolCandidates = new Set<string>();

  visit(tree, (node: SyntaxNode) => {
    if (node.type === "heading") headings.push(textOf(node));
    if (["text", "inlineCode", "code"].includes(node.type ?? "") && node.value) {
      body.push(node.value);
    }
    if (["inlineCode", "code"].includes(node.type ?? "") && node.value) {
      for (const match of node.value.matchAll(/[A-Za-z_$][\w$./:-]{2,}/g)) {
        for (const alias of identifierAliases(match[0])) symbolCandidates.add(alias);
      }
    }
  });

  for (const file of page.sourceFiles) {
    for (const alias of identifierAliases(file)) symbolCandidates.add(alias);
  }

  return {
    headings: headings.join("\n").slice(0, 30_000),
    symbols: [...symbolCandidates].join("\n").slice(0, 30_000),
    bodyText: body.join("\n").slice(0, 300_000),
    sourceFiles: page.sourceFiles.join("\n"),
  };
}

function terms(query: string): string[] {
  return query
    .normalize("NFKC")
    .match(/[\p{L}\p{N}_$./:-]+/gu)
    ?.flatMap(identifierAliases)
    .flatMap((value) => value.split(/\s+/))
    .filter(Boolean)
    .slice(0, 16) ?? [];
}

export function exactIdentifierCandidates(query: string): string[] {
  const candidates = query
    .normalize("NFKC")
    .match(/[\p{L}_$][\p{L}\p{N}_$./:-]{2,}/gu) ?? [];
  return [...new Set(candidates.filter((value) =>
    /[A-Z_$]/.test(value.slice(1))
      || /[_$/:]/.test(value)
      || /^[a-z][\w.-]*\.(?:[cm]?[jt]sx?|py|rb|rs|go|java|kt|swift|php|cs|c|cc|cpp|h|hpp)$/.test(value),
  ))].slice(0, 12);
}

const CONTEXT_STOP_WORDS = new Set([
  "a", "an", "and", "are", "around", "as", "at", "be", "been", "but", "by",
  "can", "cite", "compare", "connect", "could", "do", "does", "enabled", "exact",
  "explain", "files", "for", "from", "give", "how", "in", "into", "is", "it",
  "its", "list", "me", "needed", "of", "on", "or", "please", "show", "source",
  "symbols", "tell", "than", "that", "the", "their", "then", "this", "to", "trace",
  "using", "versus", "what", "when", "where", "which", "while", "with", "work",
]);

function contextWords(value: string) {
  return value
    .normalize("NFKC")
    .match(/[\p{L}\p{N}_$./:-]+/gu)
    ?.filter((word) => word.length >= 3 && !CONTEXT_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 10) ?? [];
}

export function contextSearchFacets(task: string): string[] {
  const segmented = task.replace(
    /,\s*(?=(?:compare|connect|explain|list|show|cite|trace)\b)/gi,
    "; ",
  );
  const clauses = segmented.split(/[\n;.!?]+/).map((clause) => contextWords(clause));
  const facets: string[] = [];
  for (const words of clauses) {
    if (words.length < 2) continue;
    const facet = words.join(" ");
    if (!facets.includes(facet)) facets.push(facet);
    if (facets.length >= 4) break;
  }
  if (!facets.length) {
    const fallback = contextWords(task).join(" ");
    if (fallback) facets.push(fallback);
  }
  return facets;
}

function quotedPrefix(term: string): string {
  return `"${term.replaceAll('"', '""')}" *`;
}

export function toFtsMatch(query: string, mode: "all" | "any" = "all"): string {
  const queryTerms = [...new Set(terms(query))];
  if (!queryTerms.length) return '""';
  return queryTerms.map(quotedPrefix).join(mode === "all" ? " " : " OR ");
}
