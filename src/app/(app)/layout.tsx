import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/server/auth/session";

/** screens 4.2: pages for signed-in users only. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();
  return (
    <>
      <AppHeader user={user} />
      {children}
    </>
  );
}
