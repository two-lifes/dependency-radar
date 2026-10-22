import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { landingCopy } from "@/features/landing/copy";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const copy = landingCopy.header;

/**
 * screens 4.1: landing, login and guest report. A signed-in user sees the
 * landing too, with "Dashboard" instead of the guest actions (screens 2).
 */
export function GuestHeader({ signedIn = false }: { signedIn?: boolean }) {
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
            {/* A full navigation: `/demo` is a route handler that sets the session cookie. */}
            <Button asChild variant="secondary" className="max-sm:hidden">
              <a href="/demo">{copy.tryDemo}</a>
            </Button>
            <Button asChild>
              <Link href="/login">{copy.signIn}</Link>
            </Button>
            {/* < 640px "Try demo" moves into a menu (screens 4.1). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={copy.menu}
                  className="sm:hidden"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <a href="/demo">{copy.tryDemo}</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        )}
      </div>
    </header>
  );
}
