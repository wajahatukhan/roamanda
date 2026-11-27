"use client";

import { format } from "date-fns";
import dynamic from "next/dynamic";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Borderless segment trigger shared by the search-pill fields: no box, brand focus ring for visibility.
const SEGMENT_TRIGGER =
  "flex h-6 w-full items-center justify-start rounded-md text-[15px] font-semibold text-roam-ink outline-none focus-visible:ring-2 focus-visible:ring-roam-accent focus-visible:ring-offset-2 aria-invalid:text-destructive";

// The calendar loads when the popover first opens. The placeholder holds its height so the popover does not jump.
const DatePicker = dynamic(() => import("./date-picker").then((m) => m.DatePicker), {
  loading: () => <div aria-hidden className="min-h-[360px] min-w-[280px]" />,
});

function summary(range: DateRange | undefined) {
  if (!range?.from) return null;
  if (!range.to) return `${format(range.from, "d MMM yyyy")} – check-out?`;
  const nights = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
  return `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")} · ${nights} night${nights === 1 ? "" : "s"}`;
}

export function DateRangeField({
  value,
  onChange,
  invalid,
  describedBy,
  triggerRef,
}: {
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
  invalid?: boolean;
  describedBy?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
}) {
  const text = summary(value);
  return (
    <Popover>
      <PopoverTrigger
        ref={triggerRef}
        id="dates-trigger"
        aria-labelledby="dates-label dates-value"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={SEGMENT_TRIGGER}
      >
        <span id="dates-value" className={cn("truncate", !text && "font-normal text-roam-muted")}>
          {text ?? "Add dates"}
        </span>
      </PopoverTrigger>
      <PopoverContent
        id="dates-popup"
        align="start"
        aria-label="Choose your dates"
        // Start on the day grid (not the month arrows) so the arrow keys move between days straight away.
        initialFocus={() => document.querySelector<HTMLElement>("#dates-popup button[data-day][tabindex='0']")}
        className="w-auto gap-3 p-3"
      >
        <DatePicker value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
