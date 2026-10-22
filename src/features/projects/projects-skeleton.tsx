import { Skeleton } from "@/components/ui/skeleton";
import { projectsCopy } from "./copy";

/** screens 5.10 loading: 6 card skeletons in the grid's columns. */
export function ProjectsSkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label={projectsCopy.loading}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6"
        >
          <div className="grid gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-4 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
