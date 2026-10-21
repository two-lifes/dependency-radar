import { toast } from "@/components/ui/toast";
import { reportCopy } from "./copy";

const copy = reportCopy.selection;

/** Copies an update command; the toast shows it either way to copy by hand. */
export async function copyUpdateCommand(command: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(command);
    toast({ title: copy.commandCopied, description: command });
  } catch {
    toast({ title: copy.copyFailed, description: command });
  }
}
