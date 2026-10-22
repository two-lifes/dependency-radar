import { authCopy } from "@/features/auth/copy";
import { StubPage } from "@/features/auth/stub-page";

// The dashboard comes in plan task 23; sign-in lands here meanwhile.
export default function ProjectsPage() {
  return <StubPage title={authCopy.stub.projects} />;
}
