"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setResidency } from "@/lib/search/residency";
import { ResidencyDialog } from "./search-form/residency-dialog-lazy";

/**
 * Asks for the passport country and stores it. The server action sets a cookie, which makes Next re-render this
 * page's server content on its own, so the rates load without a second refresh (one load, one rates request).
 */
export function ResidencyPrompt() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function choose(code: string) {
    setError(null);
    try {
      if (!(await setResidency(code)).ok) throw new Error("rejected");
      setOpen(false);
      setSaved(true);
    } catch {
      setError("We could not save your choice. Please try again.");
    }
  }

  return (
    <>
      <Button type="button" size="lg" className="h-10 px-5" disabled={saved} onClick={() => setOpen(true)}>
        {saved ? "Loading prices…" : "Choose passport country"}
      </Button>
      <ResidencyDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setError(null);
        }}
        onChoose={choose}
        error={error}
      />
    </>
  );
}
