import { redirect } from "next/navigation";
import { GuestHeader } from "@/components/guest-header";
import { sendSignInLink } from "@/features/auth/actions";
import { LoginForm } from "@/features/auth/login-form";
import type { LoginError } from "@/features/auth/login-paths";
import { safeNext } from "@/lib/safe-next";
import { isEmailSignInEnabled } from "@/server/auth/magic-link-email";
import { getOptionalSession } from "@/server/auth/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function loginError(value: string | undefined): LoginError | undefined {
  return value === "github" || value === "link-expired" ? value : undefined;
}

/** screens 5.2: guests only; a signed-in user goes straight to `next`. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = safeNext(first(params.next));
  if (await getOptionalSession()) redirect(next);

  return (
    <>
      <GuestHeader />
      <main className="flex justify-center px-4 py-16 sm:py-24">
        <LoginForm
          action={sendSignInLink}
          next={next}
          error={loginError(first(params.reason))}
          emailEnabled={isEmailSignInEnabled()}
        />
      </main>
    </>
  );
}
