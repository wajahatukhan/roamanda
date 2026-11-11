import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown in place of the list when prices could not be fetched. `href` is the same search, to try again. */
export function PricesUnavailable({ retryable, href, subject = "search" }: { retryable: boolean; href: string; subject?: "search" | "hotel" }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-[0.01em] [word-spacing:0.1em]">
          {retryable ? "Prices are taking longer than usual." : `We could not load prices for this ${subject}.`}
        </h2>
        <p className="text-muted-foreground">
          {retryable ? "Nothing is wrong with your search. Give it another go." : `Please try again in a moment${subject === "search" ? ", or change your search" : ""}.`}
        </p>
      </div>
      <Link href={href} prefetch={false} className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10 px-5")}>
        Try again
      </Link>
    </div>
  );
}
