import { AccountSection } from "@/features/profile/account-section";
import { profileCopy } from "@/features/profile/copy";
import { DeleteAccountSection } from "@/features/profile/delete-account-section";
import { GITHUB_LINK_REASON } from "@/features/profile/github-link";
import { GithubSection } from "@/features/profile/github-section";
import { getGithubConnection } from "@/features/profile/github-connection";
import { ThemeSection } from "@/features/profile/theme-section";
import { requireSession } from "@/server/auth/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens 5.13 Profile. */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [{ user }, params] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  const connection = await getGithubConnection(user.id);

  return (
    <main className="grid min-w-0 gap-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {profileCopy.title}
      </h1>
      <AccountSection name={user.name} email={user.email} />
      <GithubSection
        connection={connection}
        linkFailed={params.reason === GITHUB_LINK_REASON}
      />
      <ThemeSection />
      <DeleteAccountSection email={user.email} />
    </main>
  );
}
