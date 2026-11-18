export const MAX_FEEDBACK_REPORTS_PER_RUN = 5;
export const FEEDBACK_RETRY_CLAIM_DURATION_MS = 15 * 60 * 1000;
export const FEEDBACK_RETRY_DELAYS_MS = [
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
] as const;

export function feedbackRetryDelayMs(failedAttempts: number): number {
  const index = Math.min(Math.max(failedAttempts - 1, 0), FEEDBACK_RETRY_DELAYS_MS.length - 1);
  return FEEDBACK_RETRY_DELAYS_MS[index] ?? FEEDBACK_RETRY_DELAYS_MS.at(-1)!;
}
