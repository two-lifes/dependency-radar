import { authCopy } from "./copy";

/** Placeholder until plan tasks 23–24 build these pages. */
export function StubPage({ title }: { title: string }) {
  return (
    <main className="mx-auto grid max-w-320 gap-2 px-4 pt-8 pb-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-base text-muted-foreground">{authCopy.stub.soon}</p>
    </main>
  );
}
