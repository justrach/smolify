import { describe, expect, it } from "vitest";
import { COMMUNITY_REVIEW_THRESHOLD, reviewTrustLabel, reviewTrustProgress } from "./reviews";

describe("community review trust", () => {
  it("stays unverified below ten independent verified identities", () => {
    expect(COMMUNITY_REVIEW_THRESHOLD).toBe(10);
    expect(reviewTrustLabel(9)).toBe("Unverified");
    expect(reviewTrustProgress(9)).toBe("9/10");
  });

  it("becomes community reviewed at the threshold without overstating progress", () => {
    expect(reviewTrustLabel(10)).toBe("Community reviewed");
    expect(reviewTrustProgress(18)).toBe("10/10");
  });
});
