export type AgeBucket = "fresh" | "recent" | "aging" | "stale";

export const AGE = {
  freshMs: 10 * 60_000,
  recentMs: 30 * 60_000,
  staleMs: 90 * 60_000,
  /** Anything younger than this gets the blinking NEW tag */
  newTagMs: 3 * 60_000,
} as const;

export function ageBucket(ageMs: number): AgeBucket {
  if (ageMs < AGE.freshMs) return "fresh";
  if (ageMs < AGE.recentMs) return "recent";
  if (ageMs < AGE.staleMs) return "aging";
  return "stale";
}

/**
 * Visual weight of a detection as its photo ages. Schools move at several knots,
 * so a 90-minute-old fix is little more than a hint — we fade to 30 %.
 */
export function ageOpacity(ageMs: number): number {
  const f = ageMs / AGE.staleMs;
  return Math.max(0.3, Math.min(1, 1 - 0.7 * f));
}

/** Plot marker radius (px) from school radius (m): log scale so 20 m and 200 m are both legible. */
export function markerRadius(radiusM: number): number {
  if (radiusM <= 0) return 5;
  const r = 4.5 + 4.2 * Math.log2(Math.max(radiusM, 15) / 30);
  return Math.max(4, Math.min(15, r));
}
