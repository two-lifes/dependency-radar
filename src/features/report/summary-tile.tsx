"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { filterParsers, serializeFilters, type Filters } from "./filters";

export type TileFilter =
  | { key: "lag"; value: NonNullable<Filters["lag"]> }
  | { key: "vuln"; value: NonNullable<Filters["vuln"]> };

/**
 * screens 5.4: a tile is a link to Dependencies with its filter added to the
 * current query; on an active tile the link takes the filter off again.
 */
export function SummaryTile({
  basePath,
  filter,
  className,
  children,
}: {
  basePath: string;
  filter: TileFilter;
  className: string;
  children: ReactNode;
}) {
  const search = useSearchParams();
  const [filters] = useQueryStates(filterParsers);
  const active = filters[filter.key] === filter.value;
  const query = serializeFilters(
    search,
    filter.key === "lag"
      ? { lag: active ? null : filter.value }
      : { vuln: active ? null : filter.value },
  );

  return (
    <Link
      href={`${basePath}/dependencies${query}`}
      // Stay at the summary: the table is right below it.
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        className,
        "transition-colors duration-150 ease-out hover:bg-accent",
        active && "border-brand bg-brand-soft hover:bg-brand-soft",
      )}
    >
      {children}
    </Link>
  );
}
