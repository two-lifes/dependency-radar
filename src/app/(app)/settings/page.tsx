import { redirect } from "next/navigation";

/** screens 2: `/settings` → `/settings/profile`. */
export default function SettingsPage() {
  redirect("/settings/profile");
}
