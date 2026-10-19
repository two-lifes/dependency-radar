export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-180 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-hero sm:font-medium">
        Dependency Radar
      </h1>
      <p className="text-md text-muted-foreground">
        Paste your package.json and get an upgrade plan in seconds. No sign-up.
      </p>
    </main>
  );
}
