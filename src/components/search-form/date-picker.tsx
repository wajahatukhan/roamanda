"use client";

import { format } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { LIMITS } from "@/lib/search/params";

// Rendered only while the popover is open, so "today" is read on the client and never during prerendering.
export function DatePicker({ value, onChange }: { value: DateRange | undefined; onChange: (r: DateRange | undefined) => void }) {
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
