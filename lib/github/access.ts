export async function githubAccessTokenForUser(env: CloudflareEnv, userId: string) {
  const connected = await env.DB.prepare(
    `SELECT accessToken
     FROM account
     WHERE userId = ? AND providerId = 'github' AND accessToken IS NOT NULL
     ORDER BY updatedAt DESC
     LIMIT 1`,
  ).bind(userId).first<{ accessToken: string }>();
  return connected?.accessToken?.trim() || env.GITHUB_TOKEN?.trim() || undefined;
}
