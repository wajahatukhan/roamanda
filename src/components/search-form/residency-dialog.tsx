"use client";

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COUNTRIES } from "@/lib/search/countries";

export function ResidencyDialog({
  open,
  onOpenChange,
  onChoose,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (code: string) => void;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-[0.01em] [word-spacing:0.1em]">Which country issued your passport?</DialogTitle>
          <DialogDescription>Rates and availability can depend on it. We will remember your answer.</DialogDescription>
        </DialogHeader>
        <Command className="p-0">
          <CommandInput aria-label="Search countries" placeholder="Search countries" />
          <CommandList className="mt-2 max-h-64">
            <CommandEmpty>No country found.</CommandEmpty>
            {COUNTRIES.map((c) => (
              <CommandItem key={c.code} value={c.name} keywords={[c.code]} onSelect={() => onChoose(c.code)} className="min-h-9">
                {c.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
