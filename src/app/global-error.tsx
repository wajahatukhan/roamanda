"use client";

import { ErrorView } from "@/components/error-view";
import "./globals.css";

/** Replaces the root layout when the layout itself fails, so it brings its own document, styles and title. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong</title>
        <ErrorView error={error} onRetry={retry} />
      </body>
    </html>
  );
}
