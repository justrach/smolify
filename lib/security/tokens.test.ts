import { describe, expect, it } from "vitest";
import { readBearerToken, sha256 } from "./tokens";

describe("publish tokens", () => {
  it("hashes without retaining the source token", async () => {
    expect(await sha256("smi_123456789012345678901234")).toBe(
      "87fcfcc7dbbf9aa80a1052cb2c4fc1f6cb8c17eb8d8e01e3395d6ceff9b1e0e2",
    );
  });

  it("requires a sufficiently long bearer token", () => {
    expect(readBearerToken(new Request("https://example.test"))).toBeNull();
    expect(
      readBearerToken(
        new Request("https://example.test", {
          headers: { authorization: "Bearer smi_123456789012345678901234" },
        }),
      ),
    ).toBe("smi_123456789012345678901234");
  });
});
