/** overall_score from the API is on a 0–10 scale. */
export function clampScore(score: number): number {
  return Math.min(10, Math.max(0, score));
}

export function formatScoreWithMax(score: number): string {
  return `${clampScore(score).toFixed(1)} / 10`;
}
