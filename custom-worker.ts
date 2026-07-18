// The OpenNext worker is generated before Wrangler bundles this entry point.
// @ts-expect-error generated build artifact
import handler from "./.open-next/worker.js";
import { resolvePlatformProject } from "./lib/tenancy/hosts";

const RESERVED_PATH = /^\/(?:api(?:\/|$)|_next(?:\/|$)|favicon\.ico$|robots\.txt$|sitemap\.xml$)/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
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

    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
