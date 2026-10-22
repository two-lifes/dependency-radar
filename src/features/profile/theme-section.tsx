"use client";

import { useState, useSyncExternalStore } from "react";
import { SettingsSection } from "@/components/settings-section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { profileCopy } from "./copy";

const copy = profileCopy.theme;

const themes: ThemePreference[] = ["light", "dark", "system"];
const labels = themes.map((theme) => copy.options[theme]);

/**
 * screens 5.13 "Theme": applies at once, like the avatar menu, so there is no
 * "Save". The choice lives in this browser (decisions 13).
 */
export function ThemeSection() {
  // Storage isn't available during the server render, so it starts as
  // "System" there; another tab's choice arrives through the storage event.
  const stored = useSyncExternalStore(
    subscribeToStorage,
    readThemePreference,
    () => "system" as const,
  );
  const [chosen, setChosen] = useState<ThemePreference>();
  const theme = chosen ?? stored;

  return (
    <SettingsSection title={copy.title}>
      <SegmentedControl
        label={copy.label}
        options={labels}
        value={copy.options[theme]}
        onValueChange={(label) => {
          const next = themes.find((item) => copy.options[item] === label);
          if (!next) return;
          setChosen(next);
          setThemePreference(next);
        }}
        className="w-fit"
      />
    </SettingsSection>
  );
}

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
