import { MailCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GuestHeader } from "@/components/guest-header";
import { sendSignInLink } from "@/features/auth/actions";
import { authCopy } from "@/features/auth/copy";
import { ResendLink } from "@/features/auth/resend-link";
import { loginPath, safeNext } from "@/lib/safe-next";
import { getOptionalSession } from "@/server/auth/session";

const copy = authCopy.checkEmail;
const emailSchema = z.email();

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** screens 5.3 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNext(first(params.next));
  if (await getOptionalSession()) redirect(next);
  const email = emailSchema.safeParse(first(params.email));
  // Nothing to resend to: start over.
  if (!email.success) redirect(loginPath(next));

  return (
    <>
      <GuestHeader />
      <main className="flex justify-center px-4 py-16 sm:py-24">
        <div className="grid w-full max-w-100 justify-items-center gap-6 rounded-xl border border-border bg-card p-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground [&_svg]:size-5">
            <MailCheck aria-hidden="true" />
          </span>
          <div className="grid gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {copy.title}
            </h1>
            <p className="text-base text-muted-foreground">
              {copy.sentTo}{" "}
              <strong className="font-medium break-all text-foreground">
                {email.data}
              </strong>
              . {copy.expires}
            </p>
          </div>
          <ResendLink action={sendSignInLink} email={email.data} next={next} />
          <Link
            href={loginPath(next)}
            className="rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {copy.differentEmail}
          </Link>
        </div>
      </main>
    </>
  );
}
