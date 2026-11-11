import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { HotelMissing } from "@/components/hotel-missing";
import { buttonVariants } from "@/components/ui/button";
import { MISSING_HOTEL_HEADER } from "@/lib/hotel/missing";
import { cn } from "@/lib/utils";

function PlainNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-5 py-16 sm:px-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-4xl">We could not find that page.</h1>
        <p className="text-muted-foreground">The link may be wrong or out of date.</p>
      </div>
      <Link href="/" prefetch={false} className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-11 px-6")}>
        Back to search
      </Link>
    </main>
  );
}

/** proxy.ts marks a request for a hotel with no stored content, so that case gets its own wording (same 404 status). */
async function Which() {
  const marked = (await headers()).get(MISSING_HOTEL_HEADER) === "1";
  return marked ? <HotelMissing /> : <PlainNotFound />;
}

export default function NotFound() {
  return (
    <Suspense fallback={<main className="flex-1" aria-hidden />}>
      <Which />
    </Suspense>
  );
}
