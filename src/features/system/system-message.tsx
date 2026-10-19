import type { ReactNode } from "react";

/** Centered layout shared by the 404 page and the error boundary. */
export function SystemMessage({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </main>
  );
}
