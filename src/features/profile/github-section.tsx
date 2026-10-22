"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { authClient } from "../auth/auth-client";
import { profileCopy } from "./copy";
import { GITHUB_LINK_ERROR_PATH } from "./github-link";

const copy = profileCopy.github;

export type GithubConnection =
  | { connected: false }
  /** `login` is missing when GitHub couldn't be asked for it right now. */
  | { connected: true; login?: string };

/** screens 5.13: "Connected as @user" or "Connect GitHub". */
export function GithubSection({
  connection,
  linkFailed = false,
}: {
  connection: GithubConnection;
  /** Back from GitHub with an error (already linked elsewhere, cancelled). */
  linkFailed?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const connect = async () => {
    setPending(true);
    setFailed(false);
    // On success the browser leaves for GitHub, so pending stays on.
    const result = await authClient
      .linkSocial({
        provider: "github",
        callbackURL: "/settings/profile",
        errorCallbackURL: GITHUB_LINK_ERROR_PATH,
      })
      .catch(() => ({ error: true }));
    if (result.error) {
      setPending(false);
      setFailed(true);
    }
  };

  return (
    <SettingsSection title={copy.title}>
      {connection.connected ? (
        <p className="flex items-center gap-2 text-base">
          <Check className="size-4 text-success" aria-hidden />
          {connection.login
            ? copy.connectedAs(connection.login)
            : copy.connected}
        </p>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{copy.hint}</p>
          {failed || linkFailed ? (
            <p role="alert" className="text-sm text-danger">
              {copy.failed}
            </p>
          ) : null}
          <div>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => void connect()}
            >
              {pending ? (
                <>
                  <Loader2 className="motion-safe:animate-spin" aria-hidden />
                  {copy.connecting}
                </>
              ) : (
                copy.connect
              )}
            </Button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
