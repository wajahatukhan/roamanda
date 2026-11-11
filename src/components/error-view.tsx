"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        <Button type="button" size="lg" className="h-11 px-6" onClick={onRetry}>
          Try again
        </Button>
        <Link href="/" prefetch={false} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-6")}>
          Back to search
        </Link>
      </div>
    </main>
  );
}
