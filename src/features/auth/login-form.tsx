"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "./auth-client";
import { authCopy } from "./copy";
import {
  isFromGuestReport,
  type LoginError,
  loginErrorPath,
} from "./login-paths";
import { initialSignInLinkState, type SignInLinkAction } from "./sign-in-state";

const copy = authCopy.login;

const bannerCopy: Record<LoginError, string> = {
  github: authCopy.errors.github,
  "link-expired": authCopy.errors.linkExpired,
};

/** screens 5.2 */
export function LoginForm({
  action,
  next,
  error,
  emailEnabled = true,
}: {
  action: SignInLinkAction;
  /** Already checked by `safeNext`. */
  next: string;
  /** From `?reason=` after a failed GitHub sign-in or a dead email link. */
  error?: LoginError;
  /** False while the server can't send email: GitHub is the only way in. */
  emailEnabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialSignInLinkState,
  );
  const [githubPending, setGithubPending] = useState(false);
  const [githubFailed, setGithubFailed] = useState(false);
  const [email, setEmail] = useState("");
  // A server error stays until the next answer unless the email is edited.
  const [dismissedAttempt, setDismissedAttempt] = useState(0);
  const errorId = useId();
  const emailId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const fieldError =
    !pending && state.attempt !== dismissedAttempt ? state.error : undefined;
  const banner = githubFailed
    ? authCopy.errors.github
    : error && bannerCopy[error];
  const busy = pending || githubPending;

  // The field takes focus on error; `attempt` makes a repeated error refocus.
  useEffect(() => {
    if (state.error) emailRef.current?.focus();
  }, [state]);

  const signInWithGithub = async () => {
    setGithubPending(true);
    setGithubFailed(false);
    // On success the browser leaves for GitHub, so pending stays on.
    const result = await authClient.signIn
      .social({
        provider: "github",
        callbackURL: next,
        errorCallbackURL: loginErrorPath("github", next),
      })
      .catch(() => ({ error: true }));
    if (result.error) {
      setGithubPending(false);
      setGithubFailed(true);
    }
  };

  return (
    <div className="grid w-full max-w-100 gap-6 rounded-xl border border-border bg-card p-6">
      <div className="grid gap-2 text-center">
        {isFromGuestReport(next) ? (
          <p className="text-base text-brand-text">{copy.saveHint}</p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
      </div>

      {banner ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-base text-danger"
        >
          {banner}
        </p>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={busy}
        onClick={() => void signInWithGithub()}
      >
        {githubPending ? (
          <>
            <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
            {copy.githubPending}
          </>
        ) : (
          copy.github
        )}
      </Button>

      {emailEnabled ? (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            {copy.or}
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          {/* noValidate: the server answers with the screens 5.2 message. */}
          <form action={formAction} noValidate className="grid gap-4">
            <input type="hidden" name="next" value={next} />
            <div className="grid gap-2">
              <label htmlFor={emailId} className="text-sm font-medium">
                {copy.emailLabel}
              </label>
              <Input
                ref={emailRef}
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                placeholder={copy.emailPlaceholder}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setDismissedAttempt(state.attempt);
                }}
                disabled={busy}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? errorId : undefined}
              />
              {fieldError ? (
                <p id={errorId} role="alert" className="text-sm text-danger">
                  {fieldError}
                </p>
              ) : null}
            </div>
            <Button type="submit" size="lg" disabled={busy}>
              {pending ? (
                <>
                  <Loader2
                    className="motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  {copy.pending}
                </>
              ) : (
                copy.submit
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {copy.noPasswords}
          </p>
        </>
      ) : null}
    </div>
  );
}
