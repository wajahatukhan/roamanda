"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Guests } from "@/lib/etg/schemas";
import { LIMITS } from "@/lib/search/params";

/** Age of a child the traveller has not chosen yet; never encoded into a URL. */
export const UNSET_AGE = -1;
const AGE_ITEMS = Array.from({ length: LIMITS.maxChildAge + 1 }, (_, age) => ({
  value: String(age),
  label: age === 0 ? "Under 1" : `${age} year${age === 1 ? "" : "s"}`,
}));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function guestsSummary(rooms: Guests) {
  const adults = rooms.reduce((n, r) => n + r.adults, 0);
  const children = rooms.reduce((n, r) => n + r.children.length, 0);
  return [plural(adults, "adult"), children ? plural(children, "child", "children") : null, plural(rooms.length, "room")]
    .filter(Boolean)
    .join(" · ");
}

function Stepper({ name, room, value, min, max, onChange }: { name: string; room: number; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const full = `${name} in room ${room}`;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" aria-hidden>{name}</span>
      <div className="flex items-center gap-3" role="group" aria-label={full}>
        <Button type="button" variant="outline" size="icon" className="size-9 rounded-full" aria-label={`Decrease ${full.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus aria-hidden />
        </Button>
        <output aria-live="polite" className="w-5 text-center text-sm tabular-nums">{value}</output>
        <Button type="button" variant="outline" size="icon" className="size-9 rounded-full" aria-label={`Increase ${full.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function GuestsField({
  value,
  onChange,
  invalid,
  describedBy,
  open,
  onOpenChange,
  focusUnsetAge,
}: {
  value: Guests;
  onChange: (g: Guests) => void;
  invalid?: boolean;
  describedBy?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Incremented to ask for focus on the first child age that has not been chosen. */
  focusUnsetAge: number;
}) {
  useEffect(() => {
    if (focusUnsetAge === 0) return;
    const t = setTimeout(() => document.querySelector<HTMLElement>("[data-age-unset]")?.focus(), 80);
    return () => clearTimeout(t);
  }, [focusUnsetAge]);
  const setRoom = (i: number, patch: Partial<Guests[number]>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        id="guests-trigger"
        aria-labelledby="guests-label guests-value"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="flex h-6 w-full items-center justify-start rounded-md text-[15px] font-semibold text-roam-ink outline-none focus-visible:ring-2 focus-visible:ring-roam-accent focus-visible:ring-offset-2 aria-invalid:text-destructive"
      >
        <span id="guests-value" className="truncate">{guestsSummary(value)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Guests and rooms" className="max-h-[min(34rem,var(--available-height))] w-[min(22rem,calc(100vw-2rem))] gap-5 overflow-y-auto p-4">
        {value.map((room, i) => (
          <fieldset key={i} className="flex flex-col gap-3 border-0 p-0">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium">Room {i + 1}</legend>
              {value.length > 1 && (
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove room ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              )}
            </div>
            <Stepper name="Adults" room={i + 1} value={room.adults} min={1} max={LIMITS.maxAdults} onChange={(n) => setRoom(i, { adults: n })} />
            <Stepper
              name="Children"
              room={i + 1}
              value={room.children.length}
              min={0}
              max={LIMITS.maxChildren}
              onChange={(n) =>
                setRoom(i, { children: n > room.children.length ? [...room.children, UNSET_AGE] : room.children.slice(0, n) })
              }
            />
            <AnimatePresence initial={false}>
              {room.children.map((age, c) => (
                <motion.div
                  key={c}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-between gap-4"
                >
                  <span aria-hidden className="text-sm text-muted-foreground">
                    Child {c + 1} age
                  </span>
                  <Select
                    items={AGE_ITEMS}
                    value={age === UNSET_AGE ? null : String(age)}
                    onValueChange={(v) => setRoom(i, { children: room.children.map((a, k) => (k === c ? Number(v) : a)) })}
                  >
                    <SelectTrigger data-age-unset={age === UNSET_AGE || undefined} aria-label={`Room ${i + 1} child ${c + 1} age`} className="h-9 min-w-32">
                      <SelectValue placeholder="Choose age" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              ))}
            </AnimatePresence>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={value.length >= LIMITS.maxRooms}
          onClick={() => onChange([...value, { adults: 2, children: [] }])}
        >
          Add a room
        </Button>
      </PopoverContent>
    </Popover>
  );
}
