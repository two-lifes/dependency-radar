"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { demoCopy } from "./copy";
import { DEMO_BANNER_COOKIE } from "./demo-banner-cookie";

const copy = demoCopy.banner;

/**
 * screens 4.3: under the header on every demo page. Dismissed "until the end
 * of the session": a cookie without an expiry dies with the browser session,
 * and the layout reads it on the server, so the banner never flashes.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const dismiss = () => {
    document.cookie = `${DEMO_BANNER_COOKIE}=dismissed; path=/; samesite=lax`;
    setDismissed(true);
  };

  return (
    <div role="region" aria-label={copy.region} className="bg-brand-soft">
      <div className="mx-auto flex max-w-320 flex-wrap items-center gap-x-4 gap-y-2 py-2 pr-2 pl-4 sm:pl-6">
        <p className="min-w-0 flex-1 text-sm text-brand-text">{copy.text}</p>
        <div className="flex items-center gap-1">
          <Button asChild size="sm">
            <Link href="/login">{copy.createAccount}</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.dismiss}
            onClick={dismiss}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
