// screens 5.12
export const projectSettingsCopy = {
  title: "Project settings",
  back: "Back to report",
  save: "Save",
  saving: "Saving…",
  general: {
    title: "General",
    nameLabel: "Project name",
    saved: "Project renamed",
    failed: "Couldn't rename the project. Try again.",
  },
  source: {
    title: "Source",
    current: "Current source",
    github: "GitHub repository",
    replace: "Replace source",
    newSource: "New source",
    cancel: "Cancel",
    confirm: {
      title: "Replace source?",
      text: "This will run a new check. History is kept.",
      confirm: "Replace & check",
      cancel: "Cancel",
    },
    pending: "Replacing…",
    alreadyRunning:
      "A check is running. Wait for it to finish, then replace the source.",
  },
  danger: {
    title: "Danger zone",
    text: "Deleting a project removes its check history. This can't be undone.",
    delete: "Delete project",
  },
  loading: "Loading project settings",
  error: { title: "Couldn't load project settings.", retry: "Retry" },
} as const;
