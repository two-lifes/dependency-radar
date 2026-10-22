"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { profileCopy } from "./copy";

// screens 5.13: Notifications and Team come in 1.2.
const sections = [
  { href: "/settings/profile", label: profileCopy.nav.profile },
];

/** Vertical on desktop, tabs across the top on phones. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={profileCopy.nav.label}>
      <ul className="flex gap-1 border-b border-border md:flex-col md:border-b-0">
        {sections.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:mb-0 md:rounded-md md:border-b-0",
                  current
                    ? "border-foreground font-medium text-foreground md:bg-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground md:hover:bg-accent",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
