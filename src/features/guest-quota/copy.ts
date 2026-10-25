export const guestQuotaCopy = {
  remaining: (count: number) =>
    `${count} guest check${count === 1 ? "" : "s"} remaining`,
  exhausted: "You've used all 3 guest checks in this browser.",
  github: "Continue with GitHub",
  failed: "Couldn't load guest checks. Try again.",
  startFailed: "Couldn't start the check. Try again.",
  retry: "Retry",
};
