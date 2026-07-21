// The OpenNext worker is generated before Wrangler bundles this entry point.
// @ts-expect-error generated build artifact
import handler from "./.open-next/worker.js";
import { resolvePlatformProject } from "./lib/tenancy/hosts";
import {
  isLandingDocumentRequest,
  LANDING_CACHE_TTL_SECONDS,
  landingCacheKey,
} from "./lib/performance/landing-cache";

const RESERVED_PATH = /^\/(?:api(?:\/|$)|_next(?:\/|$)|favicon\.ico$|robots\.txt$|sitemap\.xml$)/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    const rootDomain = env.SMOLIFY_ROOT_DOMAIN.toLowerCase().replace(/^\./, "").replace(/\.$/, "");
    const appHost = new URL(env.BETTER_AUTH_URL).hostname;
    if (host === rootDomain) {
      url.protocol = "https:";
      url.hostname = appHost;
      url.port = "";
      return Response.redirect(url.toString(), 308);
    }
    const cacheLanding = isLandingDocumentRequest(request, url, appHost);
    const cacheKey = cacheLanding ? landingCacheKey(url) : null;
    const edgeCache = (caches as CacheStorage & { default: Cache }).default;
    if (cacheKey) {
      const cached = await edgeCache.match(cacheKey);
      if (cached) return cached;
    }
    const project = resolvePlatformProject(host, env.SMOLIFY_ROOT_DOMAIN);
    let routedProject = project;

    if (!routedProject && host !== new URL(env.BETTER_AUTH_URL).hostname) {
      const customDomain = await env.DB.prepare(
        `SELECT projects.slug
         FROM domains
         JOIN projects ON projects.id = domains.project_id
         WHERE domains.hostname = ?
           AND domains.kind = 'custom'
           AND domains.status = 'active'
           AND projects.deleted_at IS NULL
         LIMIT 1`,
      )
        .bind(host.toLowerCase())
        .first<{ slug: string }>();
      routedProject = customDomain?.slug ?? null;
    }

    if (routedProject && !RESERVED_PATH.test(url.pathname)) {
      url.pathname = `/${routedProject}${url.pathname === "/" ? "/introduction" : url.pathname}`;
      request = new Request(url, request) as typeof request;
    }

    const response = await handler.fetch(request, env, ctx);
    if (
      cacheKey
      && response.status === 200
      && response.headers.get("content-type")?.includes("text/html")
      && !response.headers.has("set-cookie")
    ) {
      const headers = new Headers(response.headers);
      headers.set(
        "Cache-Control",
        `public, max-age=0, s-maxage=${LANDING_CACHE_TTL_SECONDS}`,
      );
      const cacheable = new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
      ctx.waitUntil(edgeCache.put(cacheKey, cacheable.clone()));
      return cacheable;
    }

    return response;
  },
} satisfies ExportedHandler<CloudflareEnv>;
