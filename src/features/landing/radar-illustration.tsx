import { cn } from "@/lib/cn";

/**
 * style-guide 6: flat circles, rings, pills and a radar sector in brand,
 * brand-pink and foreground. Stands in for the report screenshot until task 29.
 */
export function RadarIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 320"
      aria-hidden="true"
      className={cn("h-auto w-full", className)}
    >
      <g className="fill-none stroke-foreground" strokeWidth="2">
        <circle cx="320" cy="300" r="250" opacity="0.15" />
        <circle cx="320" cy="300" r="180" opacity="0.25" />
        <circle cx="320" cy="300" r="110" opacity="0.4" />
      </g>
      {/* The sweep: a sector of the outer ring. */}
      <path
        d="M320 300 L320 50 A250 250 0 0 1 497 123 Z"
        className="fill-brand"
      />
      <circle cx="320" cy="300" r="40" className="fill-foreground" />

      {/* Blips: packages the radar has found. */}
      <circle cx="420" cy="150" r="14" className="fill-brand-pink" />
      <circle cx="190" cy="170" r="10" className="fill-brand" />
      <circle cx="235" cy="90" r="6" className="fill-foreground" />
      <circle cx="520" cy="230" r="8" className="fill-foreground" />

      {/* Pills: version badges floating around. */}
      <rect
        x="60"
        y="220"
        width="96"
        height="28"
        rx="14"
        className="fill-brand-pink"
      />
      <rect
        x="480"
        y="70"
        width="112"
        height="28"
        rx="14"
        className="fill-none stroke-brand"
        strokeWidth="2"
      />
      <rect
        x="500"
        y="270"
        width="72"
        height="20"
        rx="10"
        className="fill-brand"
      />
      <circle
        cx="96"
        cy="120"
        r="22"
        className="fill-none stroke-brand-pink"
        strokeWidth="2"
      />
    </svg>
  );
}
