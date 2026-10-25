"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GuestQuotaState } from "@/server/guest-quota";
import { safeNext } from "@/lib/safe-next";
import { authClient } from "../auth/auth-client";
import { authCopy } from "../auth/copy";
import { loginErrorPath } from "../auth/login-paths";
import { refreshGuestQuota } from "./actions";
import { guestQuotaCopy as copy } from "./copy";

type Quota = {
  state: GuestQuotaState;
  loading: boolean;
  refresh: () => Promise<void>;
  exhausted: () => void;
};
const Context = createContext<Quota | null>(null);
const accountQuota: Quota = {
  state: { kind: "account" },
  loading: false,
  refresh: async () => {
    /* Account checks have no browser quota. */
  },
  exhausted: () => {
    /* Account checks have no browser quota. */
  },
};

export function GuestQuotaProvider({
  initial,
  children,
}: {
  initial: GuestQuotaState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const refresh = async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const next = await refreshGuestQuota();
      if (request === generation.current) setState(next);
    } catch {
      if (request === generation.current) setState({ kind: "error" });
    } finally {
      if (request === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  const exhausted = () => {
    generation.current++;
    setLoading(false);
    setState({ kind: "guest", remaining: 0 });
  };
  return (
    <Context.Provider value={{ state, loading, refresh, exhausted }}>
      {children}
    </Context.Provider>
  );
}

export function useGuestQuota() {
  const quota = useContext(Context) ?? accountQuota;
  return {
    ...quota,
    blocked:
      quota.loading ||
      quota.state.kind === "error" ||
      (quota.state.kind === "guest" && quota.state.remaining === 0),
  };
}

export function GuestQuotaNotice({
  exhausted = false,
}: {
  exhausted?: boolean;
}) {
  const { state, loading, refresh } = useGuestQuota();
  if (exhausted || (state.kind === "guest" && state.remaining === 0))
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {copy.exhausted}
      </p>
    );
  if (state.kind === "account") return null;
  if (loading) return <Skeleton className="h-5 w-48" />;
  if (state.kind === "error")
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-sm text-danger"
      >
        {copy.failed}
        <Button type="button" variant="ghost" onClick={() => void refresh()}>
          {copy.retry}
        </Button>
      </div>
    );
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {copy.remaining(state.remaining)}
    </p>
  );
}

export function GuestGithubButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const signIn = async () => {
    const next = safeNext(window.location.pathname + window.location.search);
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: next,
        errorCallbackURL: loginErrorPath("github", next),
      });
      if (result.error) {
        setPending(false);
        setFailed(true);
      }
    } catch {
      setPending(false);
      setFailed(true);
    }
  };
  return (
    <div className="grid gap-2">
      <Button type="button" disabled={pending} onClick={() => void signIn()}>
        {copy.github}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {authCopy.errors.github}
        </p>
      ) : null}
    </div>
  );
}
