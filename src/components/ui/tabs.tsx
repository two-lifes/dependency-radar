"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex items-center gap-4 border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  onMouseDown,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      onMouseDown={(event) => {
        onMouseDown?.(event);
        // Radix focuses the trigger from script on mousedown, and Chrome shows
        // the focus ring for script focus as if Tab was pressed. Focusing first
        // without the ring makes Radix's focus() a no-op.
        event.currentTarget.focus({ focusVisible: false });
      }}
      className={cn(
        // -mb-px puts the 2px underline over the list's bottom border.
        "-mb-px inline-flex h-9 items-center gap-2 border-b-2 border-transparent text-base font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-brand data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-4", className)} {...props} />;
}
