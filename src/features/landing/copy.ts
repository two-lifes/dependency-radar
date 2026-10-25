// screens 5.1, 4.1, 4.6
export const landingCopy = {
  header: {
    home: "Dependency Radar home",
    signIn: "Sign in",
    dashboard: "Dashboard",
  },
  hero: {
    title:
      "Know what's outdated, vulnerable and breaking — before you upgrade.",
    subtitle:
      "Paste your package.json and get an upgrade plan in seconds. No sign-up.",
  },
  form: {
    label: "Check your dependencies",
    tabs: { paste: "Paste", upload: "Upload file", github: "GitHub URL" },
    pasteLabel: "package.json contents",
    pastePlaceholder: '{ "dependencies": { ... } }',
    dropzone: "Drop package.json (and optionally package-lock.json) here or",
    browse: "browse",
    removeFile: (name: string) => `Remove ${name}`,
    fileKind: { manifest: "package.json", lockfile: "lockfile" },
    githubLabel: "Repository URL",
    githubPlaceholder: "https://github.com/owner/repo",
    githubHint: "Public repositories only",
    submit: "Check dependencies",
    pending: "Starting…",
    sample: "or try a sample project",
  },
  errors: {
    emptyPaste: "Paste your package.json first.",
    noManifestFile: "Add a package.json file.",
    lockfileOnly:
      "Add package.json too — a lockfile alone has no dependency list.",
    twoManifests: "Drop one package.json at a time.",
    tooManyFiles: "Drop package.json and, optionally, package-lock.json.",
    unreadableFile: "Couldn't read this file. Try another one.",
    generic: "Something went wrong. Try again.",
  },
  trust: "Data from npm registry, OSV.dev and GitHub",
  howItWorks: {
    title: "How it works",
    steps: [
      {
        title: "Paste or upload",
        text: "package.json or a public repo",
      },
      {
        title: "We check every package",
        text: "versions, vulnerabilities, changelogs",
      },
      {
        title: "Get your upgrade plan",
        text: "what's safe now, what needs review",
      },
    ],
  },
  example: {
    title: "See a real report",
    text: "See outdated packages, vulnerabilities and upgrade priorities in one place.",
    imageAlt:
      "Sample dependency report with a health score, outdated packages, vulnerabilities and update commands.",
  },
  footer: {
    repo: "GitHub repo",
    madeBy: "Made by Pavel",
    portfolio: "Portfolio",
  },
} as const;
