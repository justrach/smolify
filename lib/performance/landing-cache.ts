export const LANDING_CACHE_TTL_SECONDS = 60;

export function isLandingDocumentRequest(request: Request, url: URL, appHost: string) {
  return request.method === "GET"
    && url.hostname === appHost
    && url.pathname === "/"
    && url.search === ""
    && request.headers.get("accept")?.includes("text/html") === true
    && request.headers.get("rsc") !== "1"
    && !request.headers.has("next-router-state-tree")
    && !request.headers.has("next-router-prefetch");
}

export function landingCacheKey(url: URL) {
  const key = new URL(url);
  key.searchParams.set("__smolify_cache", "landing-v1");
  return new Request(key, { method: "GET" });
}
