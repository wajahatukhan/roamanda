"use client";

import dynamic from "next/dynamic";

// Only shown when the visitor has not chosen a passport country yet; see stay-picker-lazy.
const Loaded = dynamic(() => import("./residency-prompt").then((m) => m.ResidencyPrompt));

export function ResidencyPrompt() {
  return <Loaded />;
}
