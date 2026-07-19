export type IdentityAssurance = "account" | "verified_email" | "github";

export async function getUserIdentity(env: CloudflareEnv, userId: string) {
  const identity = await env.DB.prepare(
    `SELECT user.id, user.name, user.email, user.emailVerified,
       GROUP_CONCAT(DISTINCT account.providerId) AS providers
     FROM user
     LEFT JOIN account ON account.userId = user.id
     WHERE user.id = ?
     GROUP BY user.id
     LIMIT 1`,
  ).bind(userId).first<{
    id: string;
    name: string;
    email: string;
    emailVerified: number;
    providers: string | null;
  }>();
  if (!identity) return null;
  const providers = (identity.providers ?? "").split(",").filter(Boolean);
  const trustedEmails = new Set((env.SMOLIFY_TRUSTED_IDENTITY_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));
  const assurance: IdentityAssurance = providers.includes("github")
    ? "github"
    : identity.emailVerified || trustedEmails.has(identity.email.toLowerCase())
      ? "verified_email"
      : "account";
  return {
    id: identity.id,
    name: identity.name,
    email: identity.email,
    emailVerified: Boolean(identity.emailVerified),
    providers,
    assurance,
  };
}
