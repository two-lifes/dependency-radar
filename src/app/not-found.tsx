import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { systemCopy } from "@/features/system/copy";
import { SystemMessage } from "@/features/system/system-message";
import { getOptionalSession } from "@/server/auth/session";

/** screens 5.16: "Go to projects" once signed in, "Go home" for a guest. */
export default async function NotFound() {
  const copy = systemCopy.notFound;
  const signedIn = (await getOptionalSession()) !== null;
  return (
    <SystemMessage
      icon={<FileQuestionIcon aria-hidden="true" />}
      title={copy.title}
      description={copy.description}
    >
      <Button asChild>
        {signedIn ? (
          <Link href="/projects">{copy.goToProjects}</Link>
        ) : (
          <Link href="/">{copy.goHome}</Link>
        )}
      </Button>
    </SystemMessage>
  );
}
