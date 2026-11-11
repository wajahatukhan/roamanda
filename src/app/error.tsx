"use client";

import { ErrorView } from "@/components/error-view";

/**
 * Catches failures in any page under the root layout (a content-store error on the hotel page, a chunk that failed to
 * load). `retry` re-fetches and re-renders the segment; `reset` would only re-render what already failed.
 */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      {/* The failed page's own metadata may not have resolved, so the document still gets a title. */}
      <title>Something went wrong</title>
      <ErrorView error={error} onRetry={retry} />
    </>
  );
}
