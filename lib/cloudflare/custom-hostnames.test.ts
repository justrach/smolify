import { describe, expect, it } from "vitest";
import { customHostnameState, normalizeCustomHostname } from "./custom-hostnames";

describe("normalizeCustomHostname", () => {
  it("normalizes a DNS hostname", () => {
    expect(normalizeCustomHostname(" Docs.Example.COM. ")).toBe("docs.example.com");
  });

  it.each(["localhost", "https://docs.example.com", "-docs.example.com", "docs..example.com"])(
    "rejects %s",
    (hostname) => expect(() => normalizeCustomHostname(hostname)).toThrow("valid hostname"),
  );
});

describe("customHostnameState", () => {
  it("requires both hostname and certificate activation", () => {
    expect(customHostnameState({ id: "1", hostname: "docs.example.com", status: "active", ssl: { status: "pending_validation" } }).status).toBe("verifying");
    expect(customHostnameState({ id: "1", hostname: "docs.example.com", status: "active", ssl: { status: "active" } }).status).toBe("active");
  });

  it("keeps validation instructions and errors", () => {
    const state = customHostnameState({
      id: "1",
      hostname: "docs.example.com",
      status: "blocked",
      verification_errors: [{ message: "CNAME not found" }],
      ownership_verification: { name: "_cf-custom-hostname.docs.example.com", type: "txt", value: "proof" },
    });
    expect(state.status).toBe("failed");
    expect(state.errors).toEqual(["CNAME not found"]);
    expect(state.validation.ownership?.value).toBe("proof");
  });
});
