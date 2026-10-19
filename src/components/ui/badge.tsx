import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-2xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        success: "border-success/30 bg-success-soft text-success",
        neutral:
          "border-neutral-badge/30 bg-neutral-badge-soft text-neutral-badge",
        warning: "border-warning/30 bg-warning-soft text-warning",
        danger: "border-danger/30 bg-danger-soft text-danger",
        critical: "border-critical/30 bg-critical-soft text-critical",
        moderate: "border-moderate/30 bg-moderate-soft text-moderate",
      },
      dashed: { true: "border-dashed" },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, dashed, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone, dashed }), className)}
      {...props}
    />
  );
}
