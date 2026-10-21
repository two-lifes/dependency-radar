"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFullDate, formatRelativeTime } from "@/lib/format-time";

// The server renders in its own clock and time zone; the browser corrects
// the text on hydration, hence suppressHydrationWarning on the text nodes.

/** screens 6: relative time with the full date in a tooltip. */
export function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={iso}
          tabIndex={0}
          suppressHydrationWarning
          className="rounded-sm"
        >
          {formatRelativeTime(date, new Date())}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatFullDate(date)}</TooltipContent>
    </Tooltip>
  );
}
