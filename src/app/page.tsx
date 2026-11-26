import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchForm } from "@/components/search-form/search-form";
import { SiteHeader } from "@/components/brand/site-header";
import { Hero } from "@/components/brand/hero";
import { Categories } from "@/components/brand/categories";
import { TopDestinations } from "@/components/brand/top-destinations";
import { TripIdeas } from "@/components/brand/trip-ideas";
import { StaysInLisbon } from "@/components/brand/stays-in-lisbon";
import { ThingsToDo } from "@/components/brand/things-to-do";
import { VideoStories } from "@/components/brand/video-stories";
import { Newsletter } from "@/components/brand/newsletter";
import { SiteFooter } from "@/components/brand/site-footer";
import { initialFormValues } from "@/lib/search/initial";

export const metadata: Metadata = { title: "Roamanda — Find your stay" };

export default function Home(props: PageProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero>
          {/* Reading the URL (to pre-fill after a redirect) happens at request time. The form renders once,
              already filled; the fallback reserves the form's height so the page does not jump. */}
          <Suspense fallback={<div aria-hidden className="min-h-[396px] md:min-h-[412px] lg:min-h-[140px]" />}>
            <PrefilledSearchForm searchParams={props.searchParams} />
          </Suspense>
        </Hero>
        <Categories />
        <TopDestinations />
        <TripIdeas />
        <StaysInLisbon />
        <ThingsToDo />
        <VideoStories />
        <Newsletter />
      </main>
      <SiteFooter />
    </>
  );
}

async function PrefilledSearchForm({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  return <SearchForm initial={initialFormValues(await searchParams)} />;
}
