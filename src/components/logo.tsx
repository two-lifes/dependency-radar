import { cn } from "@/lib/cn";

/** style-guide 6: a radar (circle + sector) in brand, the blip in brand-pink. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        className="stroke-brand"
        strokeWidth="2"
      />
      <path d="M12 12 L12 2 A10 10 0 0 1 21.5 9 Z" className="fill-brand" />
      <circle cx="16" cy="15.5" r="2" className="fill-brand-pink" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
      <LogoMark />
      Dependency Radar
    </span>
  );
}
