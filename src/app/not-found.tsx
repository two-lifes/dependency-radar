import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { systemCopy } from "@/features/system/copy";
import { SystemMessage } from "@/features/system/system-message";

// "Go to projects" for signed-in users comes with auth (plan task 20).
export default function NotFound() {
  const copy = systemCopy.notFound;
  return (
    <SystemMessage
      icon={<FileQuestionIcon aria-hidden="true" />}
      title={copy.title}
      description={copy.description}
    >
      <Button asChild>
        <Link href="/">{copy.goHome}</Link>
      </Button>
    </SystemMessage>
  );
}
