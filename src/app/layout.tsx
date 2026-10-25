import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeScriptFallback } from "@/components/theme-script-fallback";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeScript } from "@/lib/theme";
import { OfflineBanner } from "@/features/system/network-status";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dependency Radar",
  description:
    "Know what's outdated, vulnerable and breaking in your npm dependencies before you upgrade.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script changes class and style on <html> before hydration.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeScriptFallback />
        <OfflineBanner />
        <NuqsAdapter>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
