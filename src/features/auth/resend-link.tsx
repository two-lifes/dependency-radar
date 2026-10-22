"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authCopy } from "./copy";
import { initialSignInLinkState, type SignInLinkAction } from "./sign-in-state";

const copy = authCopy.checkEmail;

/** screens 5.3: "Resend link" waits 60 s after every sent link. */
export const RESEND_COOLDOWN_SECONDS = 60;

export function ResendLink({
  action,
  email,
  next,
}: {
  action: SignInLinkAction;
  email: string;
  next: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialSignInLinkState,
  );
  // Every successful resend starts a new wait (a new key remounts the
  // button); a failed one doesn't.
  const sentAttempt = state.sent ? state.attempt : 0;

  const message = pending
    ? undefined
    : (state.error ?? (state.sent ? copy.resent : undefined));

  return (
    <form action={formAction} className="grid justify-items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value="resend" />
      <CooldownButton key={sentAttempt} pending={pending} />
      {/* Polite: the countdown itself isn't announced every second. */}
      <p
        aria-live="polite"
        className={
          state.error ? "text-sm text-danger" : "text-sm text-muted-foreground"
        }
      >
        {message}
      </p>
    </form>
  );
}

function CooldownButton({ pending }: { pending: boolean }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const waiting = secondsLeft > 0;

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  return (
    <Button type="submit" variant="secondary" disabled={waiting || pending}>
      {pending ? (
        <>
          <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
          {copy.resending}
        </>
      ) : waiting ? (
        copy.resendIn(secondsLeft)
      ) : (
        copy.resend
      )}
    </Button>
  );
}
