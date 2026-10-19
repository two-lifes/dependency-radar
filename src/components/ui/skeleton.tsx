import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Decorative placeholder; the loading region itself should carry `aria-busy`. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-skeleton rounded-md bg-muted", className)}
      {...props}
    />
  );
}
