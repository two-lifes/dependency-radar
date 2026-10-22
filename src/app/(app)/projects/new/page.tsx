import { newProjectCopy } from "@/features/projects/copy";
import { NewProjectForm } from "@/features/projects/new-project-form";
import { requireSession } from "@/server/auth/session";
import { getGithubAccountId } from "@/server/db/accounts";
import { getDb } from "@/server/db/client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens 5.11: a page of its own, the form up to 560px wide. */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [{ user }, params] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  // Only whether GitHub is connected; the list itself loads in the browser.
  const accountId = await getGithubAccountId(getDb(), user.id);
  return (
    <main className="mx-auto grid w-full max-w-140 gap-6 px-4 pt-8 pb-16 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {newProjectCopy.title}
      </h1>
      <NewProjectForm
        initialSource={params.source === "github" ? "github" : "paste"}
        githubConnected={accountId !== undefined}
      />
    </main>
  );
}
