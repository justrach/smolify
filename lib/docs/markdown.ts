import GithubSlugger from "github-slugger";
import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type TableOfContentsItem = {
  id: string;
  label: string;
  depth: 2 | 3;
};

export type RenderedMarkdown = {
  html: string;
  tableOfContents: TableOfContentsItem[];
  searchText: string;
};

type AstNode = {
  type: string;
  value?: string;
  depth?: number;
  children?: AstNode[];
  properties?: Record<string, unknown>;
};

function textContent(node: AstNode): string {
  if (typeof node.value === "string") return node.value;
  return node.children?.map(textContent).join("") ?? "";
}

function collectDocumentData() {
  return (tree: AstNode, file: { data: Record<string, unknown> }) => {
    const slugger = new GithubSlugger();
    const tableOfContents: TableOfContentsItem[] = [];
    const searchable: string[] = [];

    visit(tree, (node: AstNode) => {
      if (node.type === "text" && node.value) searchable.push(node.value);

      if (node.type === "element" && (node as { tagName?: string }).tagName) {
        const tagName = (node as { tagName?: string }).tagName;
        if (tagName !== "h2" && tagName !== "h3") return;

        const label = textContent(node).trim();
        // Keep the sanitizer's clobber-resistant prefix in the source of truth
        // so table-of-contents links always match the emitted HTML.
        const rawId = slugger.slug(label);
        const id = `user-content-${rawId}`;
        node.properties = { ...node.properties, id: rawId };
        tableOfContents.push({ id, label, depth: tagName === "h2" ? 2 : 3 });
      }
    });

    file.data.tableOfContents = tableOfContents;
    file.data.searchText = searchable.join(" ").replace(/\s+/g, " ").trim();
  };
}

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
  },
};

export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(collectDocumentData)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(markdown);

  return {
    html: String(file),
    tableOfContents: (file.data.tableOfContents ?? []) as TableOfContentsItem[],
    searchText: String(file.data.searchText ?? ""),
  };
}
