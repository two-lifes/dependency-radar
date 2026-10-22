"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loginPath } from "@/lib/safe-next";
import { authClient } from "../auth/auth-client";
import { DemoHint } from "../demo/demo-hint";
import { deleteAccount } from "./actions";
import { profileCopy } from "./copy";

const copy = profileCopy.danger;

/** screens 5.13 "Danger zone": the email has to be typed in. */
export function DeleteAccountSection({
  email,
  demo = false,
}: {
  email: string;
  /** The shared demo account can't be deleted (plan.md 25). */
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hintId = useId();

  return (
    <SettingsSection title={copy.title} description={copy.text} danger>
      <div className="grid justify-items-start gap-2">
        <Button
          variant="destructive"
          disabled={demo}
          aria-describedby={demo ? hintId : undefined}
          onClick={() => setOpen(true)}
        >
          <Trash2 aria-hidden />
          {copy.delete}
        </Button>
        {demo ? <DemoHint id={hintId} /> : null}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent>
            <DeleteForm email={email} />
          </DialogContent>
        ) : null}
      </Dialog>
    </SettingsSection>
  );
}

function DeleteForm({ email }: { email: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<"reauth" | "failed">();
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const errorId = useId();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) return;
    setError(undefined);
    startTransition(async () => {
      try {
        // Success redirects to the landing, which shows "Account deleted".
        const result = await deleteAccount(typed);
        if (result.error === "reauth") setError("reauth");
        else if (result.error) setError("failed");
      } catch (error) {
        console.error("[profile] couldn't delete the account", error);
        setError("failed");
      }
    });
  };

  // `/login` sends a signed-in user straight on, so sign out first.
  const signInAgain = async () => {
    await authClient.signOut();
    router.push(loginPath("/settings/profile"));
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{copy.dialogTitle}</DialogTitle>
        <DialogDescription>{copy.dialogText}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <label htmlFor={inputId} className="text-base font-medium">
          {copy.confirmLabel(email)}
        </label>
        <Input
          id={inputId}
          type="email"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          aria-describedby={error ? errorId : undefined}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error === "reauth" ? (
              <>
                {copy.reauth}{" "}
                <button
                  type="button"
                  onClick={() => void signInAgain()}
                  className="rounded-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {copy.signInAgain}
                </button>
              </>
            ) : (
              copy.failed
            )}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={pending}>
            {copy.cancel}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant="destructive"
          className="bg-danger-soft"
          disabled={!matches || pending}
        >
          {pending ? (
            <>
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
              {copy.deleting}
            </>
          ) : (
            copy.confirm
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
