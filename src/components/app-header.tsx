"use client";

import { Avatar } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { isOnline, useOnlineStatus } from "@/lib/use-online-status";
import { NetworkError } from "@/features/system/network-status";
import { networkCopy } from "@/features/system/network-copy";
import { authCopy } from "@/features/auth/copy";
import {
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { Logo } from "./logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const copy = authCopy.header;

export type HeaderUser = {
  name: string;
  email: string;
  image?: string | null;
};

const themes: ThemePreference[] = ["light", "dark", "system"];

/** screens 4.2: every page after sign-in. */
export function AppHeader({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [failure, setFailure] = useState<string>();
  // Read when the menu opens: storage isn't available during the server render.
  const [theme, setTheme] = useState<ThemePreference>("system");

  const signOut = async () => {
    if (!isOnline()) return;
    setFailure(undefined);
    try {
      const result = await authClient.signOut();
      if (result?.error) {
        setFailure(networkCopy.failed);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setFailure(networkCopy.failed);
    }
  };

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-320 items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/projects"
          aria-label={copy.home}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo />
        </Link>
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) setTheme(readThemePreference());
          }}
        >
          <DropdownMenuTrigger
            aria-label={copy.account}
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar.Root className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-medium text-foreground">
              {user.image ? (
                <Avatar.Image
                  src={user.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
              <Avatar.Fallback>{initials(user)}</Avatar.Fallback>
            </Avatar.Root>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel className="grid gap-0.5 text-sm">
              <span className="truncate font-medium text-foreground">
                {user.name || user.email}
              </span>
              {user.name ? (
                <span className="truncate font-normal">{user.email}</span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">{copy.settings}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{copy.theme}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                const next = themes.find((item) => item === value);
                if (!next) return;
                setTheme(next);
                setThemePreference(next);
              }}
            >
              {themes.map((item) => (
                <DropdownMenuRadioItem key={item} value={item}>
                  {copy.themes[item]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!online}
              title={!online ? networkCopy.required : undefined}
              aria-description={!online ? networkCopy.required : undefined}
              onSelect={() => void signOut()}
            >
              {copy.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <NetworkError message={failure} onRetry={() => void signOut()} />
    </header>
  );
}

/** "Ada Lovelace" → "AL"; no name → the first letter of the email. */
export function initials({ name, email }: HeaderUser): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 0
      ? words
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
      : email.slice(0, 1);
  return letters.toUpperCase();
}
