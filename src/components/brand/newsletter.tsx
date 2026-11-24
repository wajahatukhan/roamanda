/** Newsletter signup. Visual only for now — not wired to a backend yet. */
export function Newsletter() {
  return (
    <section aria-labelledby="newsletter-heading" className="w-full bg-white px-4 py-14 sm:px-8 lg:px-20">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
        <div className="flex flex-col gap-2.5">
          <h2 id="newsletter-heading" className="text-2xl font-bold text-roam-ink">Get trip ideas in your inbox</h2>
          <p className="text-sm text-roam-muted">Monthly picks from Roamanda editors — no spam, unsubscribe anytime.</p>
        </div>
        <form className="flex h-14 w-full items-center gap-3 rounded-full border border-roam-border bg-roam-surface py-1.5 pr-1.5 pl-5 focus-within:ring-2 focus-within:ring-roam-blue md:ml-auto md:w-[440px]">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="your@email.com"
            className="min-w-0 flex-1 bg-transparent text-sm text-roam-ink outline-none placeholder:text-roam-muted"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-roam-blue px-[22px] py-3 text-[13px] font-bold text-white transition-colors hover:bg-roam-blue-dark"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}
