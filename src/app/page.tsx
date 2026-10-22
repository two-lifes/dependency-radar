import { GuestHeader } from "@/components/guest-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { startGuestCheck } from "@/features/landing/actions";
import { CheckForm } from "@/features/landing/check-form";
import { landingCopy as copy } from "@/features/landing/copy";
import { RadarIllustration } from "@/features/landing/radar-illustration";
import { AccountDeletedToast } from "@/features/profile/account-deleted-toast";
import { getOptionalSession } from "@/server/auth/session";

/** screens 5.1 */
export default async function HomePage() {
  const session = await getOptionalSession();
  return (
    <>
      <GuestHeader signedIn={session !== null} />
      <AccountDeletedToast />
      <main>
        <section className="mx-auto grid max-w-180 gap-8 px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
          <div className="grid gap-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-hero sm:font-medium">
              {copy.hero.title}
            </h1>
            <p className="text-md text-muted-foreground">
              {copy.hero.subtitle}
            </p>
          </div>
          <CheckForm action={startGuestCheck} />
          <p className="text-center text-sm text-muted-foreground">
            {copy.trust}
          </p>
        </section>

        <section
          aria-labelledby="how-it-works"
          className="mx-auto grid max-w-320 gap-8 px-4 py-16 sm:px-6 sm:py-24"
        >
          <h2
            id="how-it-works"
            className="text-center text-2xl font-semibold tracking-tight"
          >
            {copy.howItWorks.title}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {copy.howItWorks.steps.map((step, index) => (
              <li
                key={step.title}
                className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:p-6"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft font-mono text-sm font-medium text-brand-text tabular-nums">
                  {index + 1}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-base text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="example-report"
          className="mx-auto grid max-w-180 gap-6 px-4 pt-16 pb-24 text-center sm:px-6 sm:pt-24 sm:pb-32"
        >
          <div className="grid gap-2">
            <h2
              id="example-report"
              className="text-2xl font-semibold tracking-tight"
            >
              {copy.example.title}
            </h2>
            <p className="text-md text-muted-foreground">{copy.example.text}</p>
          </div>
          {/* The report screenshot replaces the illustration in task 29. */}
          <div className="grid justify-items-center gap-6 rounded-xl border border-border p-6 sm:p-10">
            <RadarIllustration className="max-w-140" />
            <Button asChild variant="secondary">
              <a href="/demo">{copy.example.openDemo}</a>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
