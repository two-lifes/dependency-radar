"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { ErrorInfo } from "next/error";
import Link from "next/link";
import { NetworkButton } from "@/features/system/network-status";
import { Button } from "@/components/ui/button";
import { systemCopy } from "@/features/system/copy";
import { SystemMessage } from "@/features/system/system-message";

// screens 5.16: technical details are never shown, so `error` is not read here.
// `retry` (not `reset`) re-fetches the failed segment, which is what "Try again" means.
export default function ErrorPage({ retry }: Pick<ErrorInfo, "retry">) {
  const copy = systemCopy.error;
  return (
    <SystemMessage
      icon={<TriangleAlertIcon aria-hidden="true" />}
      title={copy.title}
    >
      <NetworkButton onClick={retry}>{copy.tryAgain}</NetworkButton>
      <Button asChild variant="secondary">
        <Link href="/">{copy.goHome}</Link>
      </Button>
    </SystemMessage>
  );
}
