"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { reportCopy } from "./copy";
import {
  FILTER_KEYS,
  FILTER_VALUES,
  hasActiveFilters,
  type FilterKey,
  type Filters,
} from "./filters";
import type { ReportFilters } from "./use-report-filters";

const copy = reportCopy.toolbar;

/** screens 5.5: search, filter menus, chips and the "Showing" counter. */
export function DependencyToolbar({
  state,
  shown,
  total,
}: {
  state: ReportFilters;
  shown: number;
  total: number;
}) {
  const { filters, setFilters, setQuery, clear } = state;
  const searchRef = useFocusOnSlash();
  // One typed setter per key: a computed `{ [key]: value }` loses the types.
  const setters: { [K in FilterKey]: (value: Filters[K]) => void } = {
    type: (type) => void setFilters({ type }),
    lag: (lag) => void setFilters({ lag }),
    vuln: (vuln) => void setFilters({ vuln }),
    status: (status) => void setFilters({ status }),
  };
  const active = FILTER_KEYS.filter((key) => filters[key] !== null);

  return (
    <div role="group" aria-label={copy.label} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            type="search"
            value={filters.q}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.searchLabel}
            aria-keyshortcuts={copy.searchShortcut}
            className="pr-8 pl-8"
          />
          {filters.q === "" ? (
            <kbd
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border px-1.5 font-mono text-xs text-muted-foreground"
            >
              {copy.searchShortcut}
            </kbd>
          ) : null}
        </div>
        {/* screens 5.5: < 768px the menus move into the "Filters" sheet. */}
        <div className="hidden items-center gap-2 md:flex">
          {FILTER_KEYS.map((key) => (
            <FilterMenu
              key={key}
              filter={key}
              filters={filters}
              setters={setters}
            />
          ))}
        </div>
        <FiltersSheet
          filters={filters}
          setters={setters}
          active={active.length}
        />
        <p
          aria-live="polite"
          className="ml-auto text-sm text-muted-foreground tabular-nums"
        >
          {copy.showing(shown, total)}
        </p>
      </div>
      {hasActiveFilters(filters) ? (
        <ul className="flex flex-wrap items-center gap-2">
          {active.map((key) => (
            <li key={key}>
              <FilterChip
                filter={key}
                filters={filters}
                onRemove={() => setters[key](null)}
              />
            </li>
          ))}
          <li>
            <Button variant="ghost" size="sm" onClick={clear}>
              {copy.clearAll}
            </Button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function FilterMenu<K extends FilterKey>({
  filter,
  filters,
  setters,
}: {
  filter: K;
  filters: Filters;
  setters: { [P in FilterKey]: (value: Filters[P]) => void };
}) {
  const { label, values } = copy.filters[filter];
  const labels: Record<string, string> = values;
  const options = FILTER_VALUES[filter];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          {label}
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={filters[filter] ?? ""}
          onValueChange={(raw) =>
            setters[filter](options.find((value) => value === raw) ?? null)
          }
        >
          <DropdownMenuRadioItem value="">{copy.any}</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {options.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {labels[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FiltersSheet({
  filters,
  setters,
  active,
}: {
  filters: Filters;
  setters: { [P in FilterKey]: (value: Filters[P]) => void };
  active: number;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" className="md:hidden">
          <SlidersHorizontal aria-hidden className="text-muted-foreground" />
          {active > 0 ? copy.filtersCount(active) : copy.filtersButton}
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{copy.filtersTitle}</SheetTitle>
        {FILTER_KEYS.map((key) => (
          <FilterRadios
            key={key}
            filter={key}
            filters={filters}
            setters={setters}
          />
        ))}
      </SheetContent>
    </Sheet>
  );
}

function FilterRadios<K extends FilterKey>({
  filter,
  filters,
  setters,
}: {
  filter: K;
  filters: Filters;
  setters: { [P in FilterKey]: (value: Filters[P]) => void };
}) {
  const { label, values } = copy.filters[filter];
  const labels: Record<string, string> = values;
  const options = FILTER_VALUES[filter];
  const current = filters[filter] ?? "";
  const choices = [
    { value: "", label: copy.any },
    ...options.map((value) => ({ value, label: labels[value] ?? value })),
  ];
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-medium text-muted-foreground">
        {label}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="flex min-h-9 items-center gap-2 text-base"
          >
            <input
              type="radio"
              name={`filter-${filter}`}
              value={choice.value}
              checked={current === choice.value}
              onChange={() =>
                setters[filter](
                  options.find((value) => value === choice.value) ?? null,
                )
              }
              className="size-4 accent-brand"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FilterChip({
  filter,
  filters,
  onRemove,
}: {
  filter: FilterKey;
  filters: Filters;
  onRemove: () => void;
}) {
  const value = filters[filter];
  if (value === null) return null;
  const { label, values } = copy.filters[filter];
  const labels: Record<string, string> = values;
  const text = copy.chip(label, labels[value] ?? value);
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-sm bg-brand-soft pr-1 pl-2 text-sm text-brand-text">
      {text}
      <button
        type="button"
        onClick={onRemove}
        aria-label={copy.removeFilter(text)}
        className="rounded-sm p-0.5 hover:bg-background/60"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

/** screens 5.5: `/` focuses the search unless the user is already typing. */
function useFocusOnSlash() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select") !== null)
      ) {
        return;
      }
      event.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return ref;
}
