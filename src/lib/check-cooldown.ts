export const CHECK_COOLDOWN_MS = 60_000;

export function nextCheckAt(startedAt: Date | string): string {
  return new Date(
    new Date(startedAt).getTime() + CHECK_COOLDOWN_MS,
  ).toISOString();
}

export function cooldownSeconds(
  until: string | null | undefined,
  now: number,
): number {
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : 0;
}

export const checkCooldownCopy = {
  again: (seconds: number) => `Check again in ${seconds}s`,
  now: (seconds: number) => `Check now in ${seconds}s`,
  retry: (seconds: number) => `Try again in ${seconds}s.`,
};
