"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Guests } from "@/lib/etg/schemas";
import { DEFAULT_GUESTS, encodeRooms, parseSearchParams } from "@/lib/search/params";
import { getResidency, setResidency } from "@/lib/search/residency";
import { DateRangeField, toIsoDate } from "./date-range-field";
import { DestinationCombobox, type Destination } from "./destination-combobox";
import { GuestsField } from "./guests-field";
import { ResidencyDialog } from "./residency-dialog";

type Errors = { destination?: string; dates?: string; guests?: string };

export function SearchForm() {
  const router = useRouter();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();
  const [rooms, setRooms] = useState<Guests>(DEFAULT_GUESTS);
  const [errors, setErrors] = useState<Errors>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const destinationRef = useRef<HTMLInputElement>(null);
  const datesRef = useRef<HTMLButtonElement>(null);
  const target = useRef<string>("");

  function validate(): { ok: true; url: string } | { ok: false } {
    const next: Errors = {};
    if (!destination) next.destination = "Choose a destination.";
    const sp = {
      region: String(destination ? (destination.kind === "region" ? destination.id : destination.hid) : ""),
      name: destination?.name,
      in: range?.from ? toIsoDate(range.from) : undefined,
      out: range?.to ? toIsoDate(range.to) : undefined,
      rooms: encodeRooms(rooms),
    };
    const parsed = parseSearchParams(sp, new Date());
    if (!parsed.ok) {
      const dateProblems = parsed.problems.filter((p) => /check-in|check-out|dates|nights/i.test(p));
      const guestProblems = parsed.problems.filter((p) => !dateProblems.includes(p) && p !== "Choose a destination.");
      if (dateProblems.length) next.dates = dateProblems.join(" ");
      if (guestProblems.length) next.guests = guestProblems.join(" ");
    }
    setErrors(next);
    if (next.destination) destinationRef.current?.focus();
    else if (next.dates) datesRef.current?.focus();
    if (Object.keys(next).length > 0 || !destination || !parsed.ok) return { ok: false };

    const qs = new URLSearchParams();
    if (destination.kind === "region") {
      qs.set("region", String(destination.id));
      qs.set("name", destination.name);
      qs.set("in", parsed.query.checkin);
      qs.set("out", parsed.query.checkout);
      qs.set("rooms", encodeRooms(parsed.query.guests));
      return { ok: true, url: `/search?${qs}` };
    }
    qs.set("in", parsed.query.checkin);
    qs.set("out", parsed.query.checkout);
    qs.set("rooms", encodeRooms(parsed.query.guests));
    return { ok: true, url: `/hotel/${destination.hid}?${qs}` };
  }

  function go(url: string) {
    startTransition(() => router.push(url));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pending) return;
    const result = validate();
    if (!result.ok) return;
    target.current = result.url;
    setBusy(true);
    try {
      const residency = await getResidency();
      if (residency) go(result.url);
      else setDialogOpen(true);
    } catch {
      setErrors({ destination: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function onChooseCountry(code: string) {
    setDialogError(null);
    try {
      const res = await setResidency(code);
      if (!res.ok) throw new Error("rejected");
      setDialogOpen(false);
      go(target.current);
    } catch {
      setDialogError("We could not save your choice. Please try again.");
    }
  }

  const errorId = "search-errors";
  const messages = [errors.destination, errors.dates, errors.guests].filter(Boolean) as string[];

  return (
    <MotionConfig reducedMotion="user">
      <form onSubmit={onSubmit} noValidate aria-label="Search stays" className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10 sm:p-8">
        <div className="grid gap-x-5 gap-y-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.25fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="destination-input" className="text-sm font-medium">Destination</Label>
            <DestinationCombobox
              id="destination-input"
              value={destination}
              onChange={(d) => {
                setDestination(d);
                if (d) setErrors((x) => ({ ...x, destination: undefined }));
              }}
              invalid={!!errors.destination}
              describedBy={errors.destination ? errorId : undefined}
              inputRef={destinationRef}
            />
          </div>
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
              invalid={!!errors.guests}
              describedBy={errors.guests ? errorId : undefined}
            />
          </div>
          <Button type="submit" size="lg" disabled={busy || pending} className="h-12 px-8 text-base">
            {busy || pending ? "Searching…" : "Search"}
          </Button>
        </div>
        <div id={errorId} role="alert" className="empty:hidden">
          <AnimatePresence initial={false}>
            {messages.length > 0 && (
              <motion.ul
                key="errors"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-5 flex flex-col gap-1 text-sm text-destructive"
              >
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
