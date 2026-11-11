import { SearchForm } from "@/components/search-form/search-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-[0.01em] [word-spacing:0.1em] text-balance sm:text-5xl">Find your stay</h1>
        <p className="text-lg text-muted-foreground">Tell us where and when, and we will find rooms that suit your party.</p>
      </div>
      <SearchForm />
    </main>
  );
}
