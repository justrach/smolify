import { describe, expect, it } from "vitest";
import { demoBundle } from "./demo";
import { docsBundleSchema } from "./schema";

describe("docsBundleSchema", () => {
  it("accepts the checked-in demo", () => {
    expect(docsBundleSchema.parse(demoBundle).pages).toHaveLength(4);
  });

  it("rejects executable generator names and unsafe slugs", () => {
    const result = docsBundleSchema.safeParse({
      ...demoBundle,
      generator: { name: "other", model: "gpt-5.6" },
      pages: [{ ...demoBundle.pages[0], slug: "../secrets" }],
    });

    expect(result.success).toBe(false);
  });
});
