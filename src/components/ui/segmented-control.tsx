"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * One choice out of a few short options (a radiogroup with arrow-key focus).
 * Always has a value: clicking the active option doesn't clear it.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        // Radix sends "" when the active item is clicked again.
        const option = options.find((item) => item === next);
        if (option !== undefined) onValueChange(option);
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-md border border-border bg-card p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option}
          value={option}
          className="inline-flex h-full items-center rounded-sm px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground"
        >
          {option}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
