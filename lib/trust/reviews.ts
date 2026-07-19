export const COMMUNITY_REVIEW_THRESHOLD = 10;

export function reviewTrustLabel(verifiedReviewCount: number) {
  return verifiedReviewCount >= COMMUNITY_REVIEW_THRESHOLD
    ? "Community reviewed"
    : "Unverified";
}

export function reviewTrustProgress(verifiedReviewCount: number) {
  return `${Math.min(verifiedReviewCount, COMMUNITY_REVIEW_THRESHOLD)}/${COMMUNITY_REVIEW_THRESHOLD}`;
}
