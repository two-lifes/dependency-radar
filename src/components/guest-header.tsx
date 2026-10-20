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

/** screens 4.1: landing, login and guest report. */
export function GuestHeader() {
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
        <nav className="flex items-center gap-2">
          <Button asChild variant="secondary" className="max-sm:hidden">
            <Link href="/demo">{copy.tryDemo}</Link>
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
                <Link href="/demo">{copy.tryDemo}</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
