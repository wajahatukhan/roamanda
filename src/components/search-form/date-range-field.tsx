"use client";

import { format } from "date-fns";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LIMITS } from "@/lib/search/params";
import { cn } from "@/lib/utils";

export const toIsoDate = (d: Date) => format(d, "yyyy-MM-dd");

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
        className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full justify-start gap-3 px-3.5 text-base font-normal")}
      >
        <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
        <span id="dates-value" className={cn("truncate", !text && "text-muted-foreground")}>
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

// Rendered only while the popover is open, so "today" is read on the client and never during prerendering.
function DatePicker({ value, onChange }: { value: DateRange | undefined; onChange: (r: DateRange | undefined) => void }) {
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  return (
    <>
      <Calendar
        mode="range"
        autoFocus
        numberOfMonths={2}
        defaultMonth={value?.from ?? today}
        selected={value}
        onSelect={onChange}
        disabled={{ before: today }}
        // The accessible name must contain the visible day number (WCAG 2.5.3).
        labels={{ labelDayButton: (date, modifiers) => `${modifiers.today ? "Today, " : ""}${format(date, "EEEE d MMMM yyyy")}` }}
        min={1}
        max={LIMITS.maxNights}
        className="p-0"
      />
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">Stays can be up to {LIMITS.maxNights} nights.</p>
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined)} disabled={!value?.from}>
          Clear
        </Button>
      </div>
    </>
  );
}
