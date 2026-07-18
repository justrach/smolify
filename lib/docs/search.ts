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

function quotedPrefix(term: string): string {
  return `"${term.replaceAll('"', '""')}" *`;
}

export function toFtsMatch(query: string, mode: "all" | "any" = "all"): string {
  const queryTerms = [...new Set(terms(query))];
  if (!queryTerms.length) return '""';
  return queryTerms.map(quotedPrefix).join(mode === "all" ? " " : " OR ");
}
