import { landingCopy } from "@/features/landing/copy";

const copy = landingCopy.footer;

// TODO: the author will provide the repository and portfolio URLs (plan.md).
const REPO_URL = "#";
const PORTFOLIO_URL = "#";

const linkClassName =
  "rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** screens 4.6: guest pages only. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-320 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <a href={REPO_URL} className={linkClassName}>
          {copy.repo}
        </a>
        <span aria-hidden="true">·</span>
        <span>{copy.madeBy}</span>
        <span aria-hidden="true">·</span>
        <a href={PORTFOLIO_URL} className={linkClassName}>
          {copy.portfolio}
        </a>
      </div>
    </footer>
  );
}
