import { getOptionalSession } from "@/server/auth/session";
import { AppHeader } from "./app-header";
import { GuestHeader } from "./guest-header";

/** Pages open to everyone: the app header once signed in (screens 1.4). */
export async function SiteHeader() {
  const session = await getOptionalSession();
  return session ? <AppHeader user={session.user} /> : <GuestHeader />;
}
