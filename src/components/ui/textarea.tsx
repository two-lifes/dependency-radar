import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { fieldClassName } from "./input";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldClassName, "min-h-24 py-2", className)}
      {...props}
    />
  );
}
