"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { NetworkButton } from "../system/network-status";
import { useNetworkAction } from "../system/use-network-action";
import { isOnline } from "@/lib/use-online-status";

import { networkCopy } from "../system/network-copy";
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
  const network = useNetworkAction(action);
  const [state, formAction, pending] = useActionState(
    network.action,
    initialSignInLinkState,
  );
  // Every successful resend starts a new wait (a new key remounts the
  // button); a failed one doesn't.
  const sentAttempt = state.sent ? state.attempt : 0;

  const message = pending
    ? undefined
    : (state.error ?? (state.sent ? copy.resent : undefined));

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !isOnline() ||
          pending ||
          event.currentTarget.querySelector('button[type="submit"]:disabled')
        )
          event.preventDefault();
      }}
      className="grid justify-items-center gap-2"
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value="resend" />
      <CooldownButton
        key={sentAttempt}
        pending={pending}
        failed={Boolean(network.error)}
      />
      {network.error ? (
        <p role="alert" className="text-sm text-danger">
          {network.error}
        </p>
      ) : null}
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

function CooldownButton({
  pending,
  failed,
}: {
  pending: boolean;
  failed: boolean;
}) {
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
    <NetworkButton
      type="submit"
      variant="secondary"
      disabled={waiting || pending}
    >
      {pending ? (
        <>
          <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
          {copy.resending}
        </>
      ) : waiting ? (
        copy.resendIn(secondsLeft)
      ) : failed ? (
        networkCopy.retry
      ) : (
        copy.resend
      )}
    </NetworkButton>
  );
}
