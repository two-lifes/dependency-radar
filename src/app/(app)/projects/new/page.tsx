import { newProjectCopy } from "@/features/projects/copy";
import { NewProjectForm } from "@/features/projects/new-project-form";

/** screens 5.11: a page of its own, the form up to 560px wide. */
export default function NewProjectPage() {
  return (
    <main className="mx-auto grid w-full max-w-140 gap-6 px-4 pt-8 pb-16 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {newProjectCopy.title}
      </h1>
      <NewProjectForm />
    </main>
  );
}
