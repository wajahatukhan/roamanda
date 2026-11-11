"use client";

import Link from "next/link";
import { useEffect } from "react";

// The shared button look, written out: this component is part of every page's script (error boundaries load with the
// layout), and importing the cva variants and the class merger (tailwind-merge) here added several KB to each page.
const BUTTON =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-clip-padding px-6 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const PRIMARY = `${BUTTON} border-transparent bg-primary text-primary-foreground hover:bg-primary/80`;
const OUTLINE = `${BUTTON} border-border bg-background hover:bg-muted hover:text-foreground`;

/**
 * The page shown when something fails unexpectedly. Calm wording and no details of the failure. The error is logged
 * once, without the URL, cookies or anything else from the request (in production a server error arrives here as a
 * generic message with a digest that matches the server log).
 */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  useEffect(() => {
    const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;
    console.error("Page failed:", digest ? `digest ${digest}` : error instanceof Error ? error.message : "unknown error");
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-5 py-16 sm:px-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-4xl">Something went wrong</h1>
        <p className="text-muted-foreground">Please try again in a moment.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onRetry} className={PRIMARY}>
          Try again
        </button>
        <Link href="/" prefetch={false} className={OUTLINE}>
          Back to search
        </Link>
      </div>
    </main>
  );
}
