"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { reportCopy } from "./copy";

const copy = reportCopy.tabs;

/**
 * screens 5.4: tabs are links to their own URLs, and the query (filters,
 * sort, search) goes along so filters survive a tab switch.
 */
export function ReportTabs({
  basePath,
  dependencies,
  vulnerabilities,
}: {
  basePath: string;
  dependencies: number;
  /** null until the first check ends: the count isn't known yet. */
  vulnerabilities: number | null;
}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const tabs = [
    {
      href: `${basePath}/dependencies`,
      label: copy.dependencies(dependencies),
    },
    {
      href: `${basePath}/vulnerabilities`,
      label:
        vulnerabilities === null
          ? copy.vulnerabilitiesUnknown
          : copy.vulnerabilities(vulnerabilities),
    },
  ];

  return (
    <nav
      aria-label={copy.label}
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-6 border-b border-border">
        {tabs.map((tab) => {
          const current = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={query ? `${tab.href}?${query}` : tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-10 items-center border-b-2 text-base font-medium whitespace-nowrap transition-colors",
                  current
                    ? "border-brand text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
