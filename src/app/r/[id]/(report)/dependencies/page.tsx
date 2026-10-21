import { DependencyTable } from "@/features/report/dependency-table";

/** screens 5.5; a guest report gets the "Save project" hint. */
export default function DependenciesPage() {
  return <DependencyTable saveHint />;
}
