import { toast } from "@/components/ui/toast";
import { reportCopy } from "./copy";

const copy = reportCopy.selection;

/**
 * Copies an update command. Only the failure toast shows the command, so it
 * can be copied by hand; `majors` names the packages it moves across a major.
 */
export async function copyUpdateCommand(
  command: string,
  majors: readonly string[] = [],
): Promise<void> {
  try {
    await navigator.clipboard.writeText(command);
    toast(
      majors.length > 0
        ? {
            title: copy.commandCopied,
            description: copy.majorUpdatesWarning(majors),
          }
        : { title: copy.commandCopied },
    );
  } catch {
    toast({ title: copy.copyFailed, description: command });
  }
}
