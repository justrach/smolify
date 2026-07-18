import { describe, expect, it } from "vitest";
import { resolvePlatformProject } from "./hosts";

describe("resolvePlatformProject", () => {
  it("resolves a project subdomain", () => {
    expect(resolvePlatformProject("pawprint-live.smol.ly", "smol.ly")).toBe("pawprint-live");
  });

  it("does not treat app, nested, or custom domains as project subdomains", () => {
    expect(resolvePlatformProject("app.smol.ly", "smol.ly")).toBeNull();
    expect(resolvePlatformProject("deep.pawprint.smol.ly", "smol.ly")).toBeNull();
    expect(resolvePlatformProject("docs.customer.com", "smol.ly")).toBeNull();
  });
});
