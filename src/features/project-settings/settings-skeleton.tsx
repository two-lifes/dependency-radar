import { Skeleton } from "@/components/ui/skeleton";
import { projectSettingsCopy as copy } from "./copy";

/** Loading: the page's frame and its three section cards. */
export function ProjectSettingsSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label={copy.loading}
      className="mx-auto grid w-full max-w-180 gap-6 px-4 pt-8 pb-16 sm:px-6"
    >
      <div className="grid gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-48" />
      </div>
      {[2, 2, 1].map((lines, index) => (
        <div
          key={index}
          className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6"
        >
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: lines }, (_, line) => (
            <Skeleton key={line} className="h-9 w-full" />
          ))}
        </div>
      ))}
    </main>
  );
}
