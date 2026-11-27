"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, MapPin } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { countryName } from "@/lib/search/countries";
import { MIN_QUERY_LENGTH, type DestinationsResponse } from "@/lib/search/destinations";

export type Destination = { kind: "region"; id: number; name: string } | { kind: "hotel"; hid: number; name: string };

type Status = "idle" | "loading" | "ready" | "empty" | "error";
type Option = { key: string; label: string; detail: string; destination: Destination };

const DEBOUNCE_MS = 250;
const REGION_LABELS: Record<string, string> = {
  RT_CITY: "City",
  RT_COUNTRY: "Country",
  RT_REGION: "Region",
  RT_NEIGHBORHOOD: "Neighbourhood",
  RT_AIRPORT: "Airport",
};

export function DestinationCombobox({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  inputRef,
}: {
  id?: string;
  value: Destination | null;
  onChange: (d: Destination | null) => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const listId = `${uid}-list`;
  const [text, setText] = useState(value?.name ?? "");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<DestinationsResponse>({ regions: [], hotels: [] });
  const [active, setActive] = useState(-1);
  const latest = useRef(0);

  // Debounced lookup. A newer keystroke aborts the in-flight request, and a stale response is ignored.
  useEffect(() => {
    const q = search.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      latest.current++;
      return;
    }
    const id = ++latest.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/destinations?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = (await res.json()) as DestinationsResponse;
        if (id !== latest.current) return;
        if (!res.ok || body.error) {
          setData({ regions: [], hotels: [] });
          setStatus("error");
          return;
        }
        setData(body);
        setActive(-1);
        setStatus(body.regions.length + body.hotels.length === 0 ? "empty" : "ready");
      } catch {
        if (controller.signal.aborted || id !== latest.current) return;
        setData({ regions: [], hotels: [] });
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const regionOptions = useMemo<Option[]>(
    () =>
      data.regions.map((r) => ({
        key: `r-${r.id}`,
        label: r.name,
        detail: [REGION_LABELS[r.type] ?? "Region", countryName(r.countryCode.toLowerCase()) ?? r.countryCode].join(" · "),
        destination: { kind: "region", id: r.id, name: r.name },
      })),
    [data.regions],
  );
  const hotelOptions = useMemo<Option[]>(
    () => data.hotels.map((h) => ({ key: `h-${h.hid}`, label: h.name, detail: "Hotel", destination: { kind: "hotel", hid: h.hid, name: h.name } })),
    [data.hotels],
  );
  const options = useMemo(() => [...regionOptions, ...hotelOptions], [regionOptions, hotelOptions]);

  const typed = search.trim().length >= MIN_QUERY_LENGTH;
  const listVisible = open && typed && status === "ready" && options.length > 0;
  const message =
    !open || !typed
      ? null
      : status === "loading"
        ? "Searching…"
        : status === "empty"
          ? "No destinations found. Try another spelling."
          : status === "error"
            ? "Suggestions are unavailable. Try again."
            : null;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  function choose(option: Option) {
    onChange(option.destination);
    setText(option.destination.name);
    setSearch("");
    setStatus("idle");
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!listVisible) {
        if (typed && options.length > 0) setOpen(true);
        return;
      }
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (step === 1 ? (a + 1 >= options.length ? 0 : a + 1) : a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (listVisible && active >= 0 && options[active]) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  let flatIndex = 0;
  const renderGroup = (label: string, items: Option[]) =>
    items.length === 0 ? null : (
      <div role="group" aria-label={label} key={label}>
        <div aria-hidden className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        {items.map((o) => {
          const i = flatIndex++;
          return (
            <div
              key={o.key}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                i === active && "bg-muted",
              )}
            >
              {o.destination.kind === "region" ? (
                <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Building2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.detail}</span>
              </span>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listVisible && active >= 0 ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        placeholder="City, region or hotel"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSearch(e.target.value);
          setOpen(true);
          setActive(-1);
          if (value) onChange(null);
          if (e.target.value.trim().length < MIN_QUERY_LENGTH) setStatus("idle");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-6 w-full rounded-md border-0 bg-transparent p-0 text-[15px] font-semibold text-roam-ink outline-none placeholder:font-normal placeholder:text-roam-muted focus-visible:ring-2 focus-visible:ring-roam-accent focus-visible:ring-offset-2 aria-invalid:text-destructive"
      />
      <AnimatePresence>
        {(listVisible || message) && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 left-0 z-30 mt-1.5 rounded-xl bg-popover p-1.5 shadow-md ring-1 ring-foreground/10"
          >
            {listVisible && (
              <div id={listId} role="listbox" tabIndex={-1} aria-label="Destination suggestions" className="max-h-80 overflow-y-auto">
                {renderGroup("Destinations", regionOptions)}
                {renderGroup("Hotels", hotelOptions)}
              </div>
            )}
            {message && (
              <p role="status" className="px-3 py-3 text-sm text-muted-foreground">
                {message}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {!listVisible && <div id={listId} role="listbox" aria-label="Destination suggestions" hidden />}
      <p aria-live="polite" className="sr-only">
        {listVisible ? `${options.length} suggestion${options.length === 1 ? "" : "s"} available. Use the up and down arrow keys to review.` : ""}
      </p>
    </div>
  );
}
