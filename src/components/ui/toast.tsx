"use client";

import { XIcon } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "./button";

// screens 4.4: plain toasts hide after 5 s, toasts with an action (Undo) after 8 s.
export const TOAST_DURATION_MS = 5000;
export const TOAST_WITH_ACTION_DURATION_MS = 8000;

export type ToastOptions = {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastOptions & { id: number };

/*
 * A module-level store lets any code (event handlers, effects after a server action)
 * call `toast()` without threading a context through every component.
 */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emptyItems: ToastItem[] = [];

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toast(options: ToastOptions): number {
  const id = nextId++;
  items = [...items, { ...options, id }];
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribe,
    () => items,
    () => emptyItems,
  );

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          duration={
            item.action ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS
          }
          onOpenChange={(open) => {
            if (!open) dismissToast(item.id);
          }}
          className="flex animate-pop-in items-center gap-3 rounded-lg border border-border bg-popover py-3 pr-2 pl-4 text-popover-foreground shadow-overlay"
        >
          <div className="grid min-w-0 flex-1 gap-0.5 wrap-anywhere">
            <ToastPrimitive.Title className="text-base font-medium">
              {item.title}
            </ToastPrimitive.Title>
            {item.description ? (
              <ToastPrimitive.Description className="text-sm text-muted-foreground">
                {item.description}
              </ToastPrimitive.Description>
            ) : null}
          </div>
          {item.action ? (
            <ToastPrimitive.Action
              altText={item.action.label}
              onClick={item.action.onClick}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {item.action.label}
            </ToastPrimitive.Action>
          ) : null}
          <ToastPrimitive.Close
            aria-label="Dismiss"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 outline-none sm:right-4 sm:left-auto sm:w-96" />
    </ToastPrimitive.Provider>
  );
}
