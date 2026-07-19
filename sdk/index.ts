import { docsBundleSchema, type DocsBundle } from "../lib/docs/schema";

export type AccessTokenProvider = () => string | Promise<string>;

export type SmolifyClientOptions = {
  baseUrl?: string;
  accessToken: string | AccessTokenProvider;
  fetch?: typeof globalThis.fetch;
};

export class SmolifyClient {
  private readonly baseUrl: string;
  private readonly tokenProvider: AccessTokenProvider;
  private readonly request: typeof globalThis.fetch;

  constructor(options: SmolifyClientOptions) {
    this.baseUrl = (options.baseUrl ?? "https://app.smol.ly").replace(/\/$/, "");
    this.tokenProvider =
      typeof options.accessToken === "function"
        ? options.accessToken
        : () => options.accessToken as string;
    this.request = options.fetch ?? globalThis.fetch;
  }

  async publish(project: string, input: DocsBundle): Promise<{
    deploymentId: string;
    pages: number;
    url: string;
  }> {
    const bundle = docsBundleSchema.parse(input);
    return this.json(`/api/v1/projects/${encodeURIComponent(project)}/deployments`, {
      method: "POST",
      body: JSON.stringify(bundle),
      headers: { "content-type": "application/json" },
    });
  }

  search(project: string, query: string, limit = 8) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.json<{
      query: string;
      matchMode: "exact_identifier" | "all_terms" | "any_term";
      confidence: "high" | "medium" | "low";
      fallbackUsed: boolean;
      fallbackReason?: string | null;
      identifierCoverage: {
        requested: string[];
        matched: string[];
        unmatched: string[];
      };
      results: Array<{
        slug: string;
        title: string;
        description: string;
        score: number;
        snippet: string;
        sourceFiles: string[];
        matchReason: "exact_identifier" | "all_terms" | "any_term";
        matchedIdentifiers: string[];
      }>;
    }>(`/api/v1/projects/${encodeURIComponent(project)}/search?${params}`);
  }

  getPage(project: string, slug: string, options: { offset?: number; length?: number } = {}) {
    const params = new URLSearchParams();
    if (options.offset !== undefined) params.set("offset", String(options.offset));
    if (options.length !== undefined) params.set("length", String(options.length));
    return this.json<{
      slug: string;
      title: string;
      description: string;
      sourceFiles: string[];
      totalLength: number;
      markdown: string;
      offset: number;
      length: number;
    }>(
      `/api/v1/projects/${encodeURIComponent(project)}/pages/${slug
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?${params}`,
    );
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.tokenProvider();
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}` },
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Smolify request failed (${response.status})`);
    return payload;
  }
}
