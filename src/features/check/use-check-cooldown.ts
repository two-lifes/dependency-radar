"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cooldownSeconds } from "@/lib/check-cooldown";

export function useCheckCooldown(initial?: string | null) {
  const router = useRouter();
  const [received, setDeadline] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  // Server refreshes and action responses can arrive in either order.
  const until =
    initial && (!received || initial > received) ? initial : received;
  const seconds = cooldownSeconds(until, now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      tick();
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return { seconds, setDeadline };
}
