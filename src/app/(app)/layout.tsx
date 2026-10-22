import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { DemoBanner } from "@/features/demo/demo-banner";
import { DEMO_BANNER_COOKIE } from "@/features/demo/demo-banner-cookie";
import { requireSession } from "@/server/auth/session";
import { isDemoUser } from "@/server/demo/demo-user";

/** screens 4.2: pages for signed-in users only. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();
  const showDemoBanner =
    isDemoUser(user.id) && !(await cookies()).has(DEMO_BANNER_COOKIE);
  return (
    <>
      <AppHeader user={user} />
      {showDemoBanner ? <DemoBanner /> : null}
      {children}
    </>
  );
}
