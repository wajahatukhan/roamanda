"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Guests } from "@/lib/etg/schemas";
import { DEFAULT_GUESTS, encodeRooms, parseStayParams } from "@/lib/search/params";
import { getResidency, setResidency } from "@/lib/search/residency";
import { DateRangeField, toIsoDate } from "./search-form/date-range-field";
import { GuestsField, UNSET_AGE } from "./search-form/guests-field";
import { ResidencyDialog } from "./search-form/residency-dialog-lazy";

export type StayPickerInitial = { range?: DateRange; rooms?: Guests };

/** Dates and guests for a hotel page (no destination: the hotel is already chosen). Goes to the same hotel with the stay in the URL. */
export function StayPicker({ hid, initial }: { hid: number; initial?: StayPickerInitial }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>(initial?.range);
  const [rooms, setRooms] = useState<Guests>(initial?.rooms ?? DEFAULT_GUESTS);
  const [errors, setErrors] = useState<{ dates?: string; guests?: string }>({});
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [ageFocusTick, setAgeFocusTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const datesRef = useRef<HTMLButtonElement>(null);
  const target = useRef("");

  function validate(): string | null {
    const ageUnset = rooms.some((r) => r.children.includes(UNSET_AGE));
    const parsed = parseStayParams(
      { in: range?.from ? toIsoDate(range.from) : undefined, out: range?.to ? toIsoDate(range.to) : undefined, rooms: encodeRooms(ageUnset ? DEFAULT_GUESTS : rooms) },
      new Date(),
    );
    const next: { dates?: string; guests?: string } = {};
    if (!parsed.ok) {
      const dateProblems = parsed.problems.filter((p) => /check-in|check-out|dates|nights/i.test(p));
      const guestProblems = parsed.problems.filter((p) => !dateProblems.includes(p));
      if (dateProblems.length) next.dates = dateProblems.join(" ");
      if (guestProblems.length) next.guests = guestProblems.join(" ");
    }
    if (ageUnset) next.guests = [next.guests, "Choose an age for each child."].filter(Boolean).join(" ");
    setErrors(next);
    if (next.dates) datesRef.current?.focus();
    else if (ageUnset) {
      setGuestsOpen(true);
      setAgeFocusTick((t) => t + 1);
    }
    if (Object.keys(next).length > 0 || !parsed.ok) return null;
    const qs = new URLSearchParams({ in: parsed.query.checkin, out: parsed.query.checkout, rooms: encodeRooms(parsed.query.guests) });
    return `/hotel/${hid}?${qs}`;
  }

  const go = (url: string) => startTransition(() => router.push(url));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pending) return;
    const url = validate();
    if (!url) return;
    target.current = url;
    setBusy(true);
    try {
      if (await getResidency()) go(url);
      else setDialogOpen(true);
    } catch {
      setErrors({ dates: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function onChooseCountry(code: string) {
    setDialogError(null);
    try {
      if (!(await setResidency(code)).ok) throw new Error("rejected");
      setDialogOpen(false);
      go(target.current);
    } catch {
      setDialogError("We could not save your choice. Please try again.");
    }
  }

  const errorId = "stay-errors";
  const messages = [errors.dates, errors.guests].filter(Boolean) as string[];

  return (
    <MotionConfig reducedMotion="user">
      <form onSubmit={onSubmit} noValidate aria-label="Choose your stay" className="flex flex-col gap-5">
        <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col gap-2">
            <Label id="dates-label" htmlFor="dates-trigger" className="text-sm font-medium">Check-in and check-out</Label>
            <DateRangeField
              value={range}
              onChange={(r) => {
                setRange(r);
                if (r?.from && r.to) setErrors((x) => ({ ...x, dates: undefined }));
              }}
              invalid={!!errors.dates}
              describedBy={errors.dates ? errorId : undefined}
              triggerRef={datesRef}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label id="guests-label" htmlFor="guests-trigger" className="text-sm font-medium">Guests and rooms</Label>
            <GuestsField
              value={rooms}
              onChange={(g) => {
                setRooms(g);
                setErrors((x) => ({ ...x, guests: undefined }));
              }}
              open={guestsOpen}
              onOpenChange={setGuestsOpen}
              focusUnsetAge={ageFocusTick}
              invalid={!!errors.guests}
              describedBy={errors.guests ? errorId : undefined}
            />
          </div>
          <Button type="submit" size="lg" disabled={busy || pending} className="h-12 px-8 text-base sm:col-span-2 lg:col-span-1">
            {busy || pending ? "Loading…" : "Show prices"}
          </Button>
        </div>
        <div id={errorId} role="alert" className="empty:hidden">
          <AnimatePresence initial={false}>
            {messages.length > 0 && (
              <motion.ul key="errors" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-1 text-sm text-destructive">
                {messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </form>
      <ResidencyDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setDialogError(null);
        }}
        onChoose={onChooseCountry}
        error={dialogError}
      />
    </MotionConfig>
  );
}
