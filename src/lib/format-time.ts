const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Short units as in screens.md ("5 min ago", "2 h ago", "3 days ago");
// Intl.RelativeTimeFormat's short style would give "5 min. ago".
const UNITS = [
  { ms: 365 * DAY, one: "year", many: "years" },
  { ms: 30 * DAY, one: "month", many: "months" },
  { ms: 7 * DAY, one: "week", many: "weeks" },
  { ms: DAY, one: "day", many: "days" },
  { ms: HOUR, one: "h", many: "h" },
  { ms: MINUTE, one: "min", many: "min" },
] as const;

/** screens 6: "3 days ago". A date in the future (clock skew) is "just now". */
export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  for (const unit of UNITS) {
    const count = Math.floor(elapsed / unit.ms);
    if (count >= 1) return `${count} ${count === 1 ? unit.one : unit.many} ago`;
  }
  return "just now";
}

/** The full date for the tooltip next to a relative time. */
export function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** "25 Oct", as in "expires on 25 Oct". */
export function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}
