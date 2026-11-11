import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchForm } from "@/components/search-form/search-form";
import { initialFormValues } from "@/lib/search/initial";

export const metadata: Metadata = { title: "Search hotels" };

export default function Home(props: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-5xl">Find your stay</h1>
        <p className="text-lg text-muted-foreground">Tell us where and when, and we will find rooms that suit your party.</p>
      </div>
      {/* Reading the URL (to pre-fill after a redirect) happens at request time. The form renders once, already filled: an empty fallback form would be replaced (and lose what was typed) when the real one streams in. The fallback only reserves the form's height so the page does not jump. */}
      <Suspense fallback={<div aria-hidden className="min-h-[396px] md:min-h-[412px] lg:min-h-[140px]" />}>
        <PrefilledSearchForm searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function PrefilledSearchForm({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  return <SearchForm initial={initialFormValues(await searchParams)} />;
}
