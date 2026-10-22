const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** screens 5.10 and 5.11: Project name is at most this long. */
export const PROJECT_NAME_MAX = 60;

// screens 5.10
export const projectsCopy = {
  title: "Projects",
  newProject: "New project",
  empty: {
    title: "No projects yet",
    text: "Add a project to track its dependencies over time.",
  },
  error: { title: "Couldn't load projects.", retry: "Retry" },
  loading: "Loading projects",
  card: {
    source: { paste: "Pasted manually", upload: "package.json upload" },
    score: "Health score",
    noScore: "No score",
    vulnerabilities: (count: number) =>
      count === 0
        ? "No vulnerabilities"
        : plural(count, "vulnerability", "vulnerabilities"),
    checked: "Checked",
    checking: (percent: number) => `Checking… ${percent}%`,
    queued: "Queued",
    failed: "Check failed",
    actions: (name: string) => `Actions for ${name}`,
    checkNow: "Check now",
    settings: "Settings",
    delete: "Delete",
  },
  delete: {
    title: "Delete project?",
    text: (name: string) =>
      `This permanently deletes ${name} and its check history.`,
    confirmLabel: (name: string) => `Type ${name} to confirm`,
    confirm: "Delete project",
    cancel: "Cancel",
    deleting: "Deleting…",
    done: "Project deleted",
    failed: "Couldn't delete the project. Try again.",
  },
} as const;

// screens 5.11
export const newProjectCopy = {
  title: "New project",
  nameLabel: "Project name",
  nameHintGithub: "Leave empty to use the name from package.json.",
  sourceLabel: "Source",
  errors: {
    nameRequired: "Enter a project name.",
    nameTooLong: `Use ${PROJECT_NAME_MAX} characters or fewer.`,
  },
  submit: "Create & check",
  pending: "Creating…",
  cancel: "Cancel",
  discard: {
    title: "Discard changes?",
    text: "The project hasn't been created yet.",
    confirm: "Discard",
    keep: "Keep editing",
  },
} as const;
