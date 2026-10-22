import { authCopy } from "@/features/auth/copy";
import { StubPage } from "@/features/auth/stub-page";

// The profile settings come in plan task 24.
export default function ProfilePage() {
  return <StubPage title={authCopy.stub.profile} />;
}
