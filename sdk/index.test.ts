import { describe, expect, it, vi } from "vitest";
import { SmolifyClient } from "./index";

describe("SmolifyClient", () => {
  it("resolves an OAuth access token for each request", async () => {
    const tokenProvider = vi.fn().mockResolvedValue("short-lived-oauth-token");
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ query: "pet", matchMode: "all_terms", results: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new SmolifyClient({
      baseUrl: "https://app.smol.ly/",
      accessToken: tokenProvider,
      fetch: request,
    });

    await client.search("pawprint", "pet");

    expect(tokenProvider).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(
      "https://app.smol.ly/api/v1/projects/pawprint/search?q=pet&limit=8",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer short-lived-oauth-token" }),
      }),
    );
  });
});
