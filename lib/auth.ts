import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { jwt, organization } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";

export const SMOLIFY_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "projects:read",
  "docs:read",
  "docs:contribute",
  "docs:publish",
] as const;

export async function createAuth(request?: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const requestOrigin = request ? new URL(request.url).origin : undefined;
  const isLocalRequest = requestOrigin
    ? ["localhost", "127.0.0.1"].includes(new URL(requestOrigin).hostname)
    : false;
  const baseURL = isLocalRequest ? requestOrigin! : env.BETTER_AUTH_URL;
  const github =
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : undefined;

  return betterAuth({
    appName: "Smolify",
    database: env.DB,
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    // Never trust an arbitrary request host: customer custom domains route
    // through this Worker but must not become Better Auth origins.
    trustedOrigins: [baseURL],
    disabledPaths: ["/token"],
    emailAndPassword: { enabled: true },
    socialProviders: github,
    advanced: {
      cookiePrefix: "smolify",
      // Cloudflare removes client-controlled copies and supplies this header
      // at the edge, giving Better Auth a trustworthy rate-limit key.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      // Dashboard cookies are deliberately host-only. Public documentation
      // subdomains and customer custom domains must never receive them.
      crossSubDomainCookies: { enabled: false },
    },
    plugins: [
      organization(),
      jwt({
        jwt: { issuer: baseURL },
        jwks: { keyPairConfig: { alg: "EdDSA", crv: "Ed25519" } },
      }),
      oauthProvider({
        loginPage: "/login",
        consentPage: "/consent",
        scopes: [...SMOLIFY_OAUTH_SCOPES],
        resources: [
          {
            identifier: `${baseURL}/mcp`,
            name: "Smolify MCP",
            accessTokenTtl: 15 * 60,
            refreshTokenTtl: 30 * 24 * 60 * 60,
            allowedScopes: ["projects:read", "docs:read", "docs:contribute", "docs:publish"],
          },
        ],
        // Smolify has one protected resource. Dynamically registered desktop
        // clients may request it after the user explicitly consents.
        enforcePerClientResources: false,
        allowPublicClientPrelogin: true,
        allowDynamicClientRegistration: true,
        // Codex and other desktop agents are public clients and cannot safely
        // retain a client secret. PKCE remains mandatory for these clients.
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultScopes: [
          "openid",
          "profile",
          "offline_access",
          "projects:read",
          "docs:read",
          "docs:contribute",
        ],
        clientRegistrationAllowedScopes: ["email", "docs:contribute", "docs:publish"],
        accessTokenExpiresIn: 15 * 60,
        scopeExpirations: { "docs:publish": "15m" },
        prefix: {
          refreshToken: "sm_rt_",
          clientSecret: "sm_cs_",
        },
        silenceWarnings: {
          oauthAuthServerConfig: true,
          openidConfig: true,
        },
      }),
      nextCookies(),
    ],
  });
}
