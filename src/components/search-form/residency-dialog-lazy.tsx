"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ComponentProps } from "react";
import type { ResidencyDialog as Dialog } from "./residency-dialog";

// The dialog and its country list load the first time it is opened, not with the page.
const Loaded = dynamic(() => import("./residency-dialog").then((m) => m.ResidencyDialog), { ssr: false });

export function ResidencyDialog(props: ComponentProps<typeof Dialog>) {
  const [wanted, setWanted] = useState(props.open);
  if (props.open && !wanted) setWanted(true);
  return wanted ? <Loaded {...props} /> : null;
}
