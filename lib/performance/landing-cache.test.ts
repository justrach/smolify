import { describe, expect, it } from "vitest";
import { isLandingDocumentRequest, landingCacheKey } from "./landing-cache";

const APP_HOST = "app.smol.ly";

function landingRequest(
  url = "https://app.smol.ly/",
  init: RequestInit = {},
) {
  return new Request(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
    ...init,
  });
}

describe("landing document cache", () => {
  it("accepts only the canonical HTML document request", () => {
    const request = landingRequest();

    expect(isLandingDocumentRequest(request, new URL(request.url), APP_HOST)).toBe(true);
  });

  it.each([
    ["non-GET method", landingRequest(undefined, { method: "POST" })],
    ["different host", landingRequest("https://react.smol.ly/")],
    ["different path", landingRequest("https://app.smol.ly/explore")],
    ["query string", landingRequest("https://app.smol.ly/?q=react")],
    ["non-HTML request", landingRequest(undefined, { headers: { accept: "application/json" } })],
    ["RSC request", landingRequest(undefined, { headers: { accept: "text/x-component", rsc: "1" } })],
    ["router state request", landingRequest(undefined, { headers: { accept: "text/html", "next-router-state-tree": "state" } })],
    ["router prefetch", landingRequest(undefined, { headers: { accept: "text/html", "next-router-prefetch": "1" } })],
  ])("rejects a %s", (_label, request) => {
    expect(isLandingDocumentRequest(request, new URL(request.url), APP_HOST)).toBe(false);
  });

  it("uses a private synthetic URL as the Cache API key", () => {
    const key = landingCacheKey(new URL("https://app.smol.ly/"));

    expect(key.url).toBe("https://app.smol.ly/?__smolify_cache=landing-v1");
  });
});
