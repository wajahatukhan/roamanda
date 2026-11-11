import { Building2 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown, with a 404 status, for a hotel that has no stored content. */
export function HotelMissing() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-5 py-16 sm:px-8">
      <Building2 aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.25} />
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-4xl">We don&apos;t have details for this hotel yet.</h1>
        <p className="text-muted-foreground">It may be new to us, or no longer listed. Search again to find somewhere to stay.</p>
      </div>
      <Link href="/" prefetch={false} className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-11 px-6")}>
        Back to search
      </Link>
    </main>
  );
}
