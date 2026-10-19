import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Shared by Input and Textarea; `aria-invalid` marks the field as having an error. */
export const fieldClassName =
  "w-full rounded-md border border-input bg-background px-3 text-base text-foreground transition-colors duration-150 ease-out placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:outline-danger";

export function Input({
  className,
  type = "text",
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(fieldClassName, "h-9", className)}
      {...props}
    />
  );
}
