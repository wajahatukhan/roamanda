"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { StayPicker as Picker } from "./stay-picker";

// Only shown when the hotel page lacks valid dates, so its code (date picker, forms, animation) stays out of the
// first download of every other hotel page view. Rendered during SSR, so the markup is still in the first HTML.
const Loaded = dynamic(() => import("./stay-picker").then((m) => m.StayPicker));

export function StayPicker(props: ComponentProps<typeof Picker>) {
  return <Loaded {...props} />;
}
