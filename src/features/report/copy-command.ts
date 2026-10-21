import { toast } from "@/components/ui/toast";
import { reportCopy } from "./copy";

const copy = reportCopy.selection;

/**
 * Copies an update command; the toast shows it either way to copy by hand.
 * `majors` names the packages it moves across a major, to warn about them.
 */
export async function copyUpdateCommand(
  command: string,
  majors: readonly string[] = [],
): Promise<void> {
  try {
    await navigator.clipboard.writeText(command);
    toast({
      title:
        majors.length > 0
          ? copy.commandCopiedWithMajors(majors)
          : copy.commandCopied,
      description: command,
    });
  } catch {
    toast({ title: copy.copyFailed, description: command });
  }
}
