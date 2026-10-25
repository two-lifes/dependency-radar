"use client";

import { WifiOff } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { isOnline, useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/cn";
import { networkCopy as copy } from "./network-copy";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>{copy.offline}</span>
    </div>
  );
}

/** Kept outside UI primitives: only explicitly marked network actions use it. */
export function NetworkButton({
  disabled,
  onClickCapture,
  ...props
}: ButtonProps) {
  const online = useOnlineStatus();
  return (
    <Button
      {...props}
      className={cn(props.className, !online && props.asChild && "opacity-50")}
      disabled={disabled || !online}
      aria-disabled={!online || undefined}
      aria-description={!online ? copy.required : undefined}
      title={!online ? copy.required : props.title}
      onClickCapture={(event) => {
        // Also covers slotted links and a disconnect between render and click.
        if (!isOnline()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClickCapture?.(event);
      }}
    />
  );
}

export function OfflineNotice() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {copy.waiting}
    </p>
  );
}

export function NetworkError({
  message,
  onRetry,
  disabled = false,
}: {
  message: string | null | undefined;
  onRetry?: () => void;
  disabled?: boolean;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 text-sm text-danger"
    >
      <span>{message}</span>
      <NetworkButton
        type={onRetry ? "button" : "submit"}
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={onRetry}
      >
        {copy.retry}
      </NetworkButton>
    </div>
  );
}
