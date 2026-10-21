import type { ReactNode } from "react";

export function EmptyState({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid justify-items-center gap-3 rounded-xl border border-border bg-card px-4 py-12 text-center [&>svg]:size-5">
      {icon}
      {children}
    </section>
  );
}
