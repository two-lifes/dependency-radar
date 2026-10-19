/** The parts of an npm registry document the version analysis needs. */
export type RegistryPackage = {
  versions: Record<string, { deprecated?: string }>;
  distTags: Record<string, string>;
  /** Publish date (ISO string) per version, plus npm's `created` / `modified`. */
  time: Record<string, string>;
};
