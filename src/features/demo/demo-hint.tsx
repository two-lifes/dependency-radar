import { demoCopy } from "./copy";

/** Under a disabled action; the button points at it with aria-describedby. */
export function DemoHint({ id }: { id: string }) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {demoCopy.unavailable}
    </p>
  );
}
