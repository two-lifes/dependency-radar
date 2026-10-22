import type { ReactNode } from "react";
import { SettingsNav } from "@/features/profile/settings-nav";

/** screens 5.13: the sections menu on the left, the section on the right. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-240 gap-6 px-4 pt-8 pb-16 sm:px-6 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-10">
      <SettingsNav />
      {children}
    </div>
  );
}
