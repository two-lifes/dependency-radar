"use client";

import { useSyncExternalStore } from "react";
import { loginPath } from "@/lib/safe-next";
import Link from "next/link";
import { landingCopy } from "@/features/landing/copy";
import { Logo } from "./logo";
import { Button } from "./ui/button";

const copy = landingCopy.header;
const subscribe = (update: () => void) => {
  window.addEventListener("popstate", update);
  return () => window.removeEventListener("popstate", update);
};
const currentLoginPath = () =>
  loginPath(window.location.pathname + window.location.search);

/**
 * screens 4.1: landing, login and guest report. A signed-in user sees the
 * landing too, with "Dashboard" instead of the guest actions (screens 2).
 */
export function GuestHeader({ signedIn = false }: { signedIn?: boolean }) {
  const signIn = useSyncExternalStore(
    subscribe,
    currentLoginPath,
    () => "/login",
  );
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-320 items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={copy.home}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo />
        </Link>
        {signedIn ? (
          <nav className="flex items-center gap-2">
            <Button asChild>
              <Link href="/projects">{copy.dashboard}</Link>
            </Button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Button asChild>
              <Link
                href={signIn}
                onClick={(event) => {
                  // Read at click time too: filters may have changed the query.
                  event.preventDefault();
                  window.location.assign(currentLoginPath());
                }}
              >
                {copy.signIn}
              </Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
