import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { createAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await createAuth(request);
  return oauthProviderOpenIdConfigMetadata(auth)(request);
}
