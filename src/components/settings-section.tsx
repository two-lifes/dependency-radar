import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled card of a settings page (screens 5.12, 5.13). */
export function SettingsSection({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description?: string;
  /** "Danger zone": the red frame. */
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-4 rounded-xl border bg-card p-4 sm:p-6",
        danger ? "border-danger/50" : "border-border",
      )}
    >
      <div className="grid gap-1">
        <h2
          className={cn(
            "text-md font-semibold",
            danger ? "text-danger" : "text-foreground",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
