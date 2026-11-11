# Travel portal: design

Date: 2026-11-11
Status: draft, awaiting Ali's approval
Working name: `travel-portal` (brand name not chosen yet)

Lines marked **(Ali)** are decisions Ali made. Lines marked **(my call)** are
defaults Claude chose; Ali can overturn any of them.

---

## 1. Intent

A hotel booking website for premium buyers that replaces "scroll through 300
hotels" with "answer four quick questions, get three well-reasoned picks".
**(Ali)**

It should feel like Booking.com, but more advanced, easier to use, more
accessible, and with better UI and UX. **(Ali)**

Why: the big platforms (Booking.com, Expedia, Agoda) all run the same flow of
search form, long list, filters, room table, checkout. The work of choosing is
left to the traveler, and the screens are crowded with urgency messages,
coupons and inflated strike-through prices. A premium traveler wants a
confident recommendation and an honest price.

Inventory comes from the RateHawk / Emerging Travel Group (ETG) B2B API. A
sandbox is active now; production credentials follow certification. **(Ali)**

## 2. Who it is for

Premium buyers booking one of four kinds of trip **(Ali)**:

- Family holiday
- Escape
- Personal getaway
- Business travel

## 3. Goals

1. A traveler gets from the home page to three suitable hotels in under a
   minute, without touching a filter.
2. Each pick says why it fits this traveler and names one honest trade-off.
3. **Realistic prices (Ali):** the first price a traveler sees is the price
   they pay. Details in section 8.
4. Cancellation terms are stated in one plain sentence per rate.
5. The complete booking flow works end to end against RateHawk and passes
   their certification.
6. Accessible: meets WCAG 2.2 AA. **(my call on the specific standard)**
7. **Fast (Ali):** built on robust, mainstream technology and tuned for the
   shortest possible load time. Targets in section 14.

## 4. Non-goals for the first build

- Flights, cars, transfers, packages. The ETG B2B API covers hotels only.
- A native mobile app. The site must work well on phones; an app would need
  its own RateHawk certification later.
- A free-form chat assistant. See section 6.
- Loyalty programme, coupons, promo codes.
- Languages other than English. **(my call)**
- Waves 2 and 3 (section 12) are designed for but not built.

## 5. Anti-goals (would make it a failure even if it works)

- Any fake urgency: countdown timers, "only 2 left", "booked 19 times today".
- A strike-through price that RateHawk did not send as a real discount.
- A fee that first appears at checkout.
- The AI stating a price, room name, meal plan or cancellation term that
  differs from what RateHawk returned.
- A results page that looks like a long list with an AI banner on top.

## 6. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | **Chat-first.** Home page is one box; the AI talks the traveler to three picks. | Most novel. Slow for people who know what they want. Likely to be treated by RateHawk as a separate "Chatbot" product needing its own certification. |
| B | **Classic search with AI on top.** Booking-style search bar; results open with three picks above the full list. | Most familiar and safest to certify. Least different from Booking.com. |
| C | **Guided brief.** Four quick taps plus an optional free-text box, then a page of three picks. Full list and filters one click away. | Faster than chat, no blank box, easier to make accessible, certifies as a normal website. Less flexible than chat for unusual requests. |

**Chosen: C (Ali).** It delivers "easier than Booking" in the first ten
seconds and suits both a family planning a holiday and a business traveler in
a hurry.

## 7. The experience

### 7.1 Guided brief (home page)

Four steps, each one screen-width card, all reachable by keyboard:

1. **Trip type:** family holiday, escape, personal getaway, business travel.
2. **Where:** destination search (city, region, or a specific hotel name).
3. **When and who:** dates, adults, children with ages, rooms.
   RateHawk limits: up to 30 nights, 6 adults and 4 children per room,
   children are 17 or under.
4. **What matters most:** a short set of options that changes with trip type
   (for example family: space, pool, kids' facilities, quiet; business: close
   to a given address, reliable wifi, late check-in). Pick up to three.
   **(my call on the limit of three)**

Plus one optional free-text box: "Anything else we should know?"

A returning visitor who wants a specific hotel can type its name in step 2 and
go straight to the hotel page. **(my call)**

Passport country is asked once, on first use, and remembered. RateHawk
requires it on every search and hotel-page request, and it can change both
price and availability. **(my call on when to ask)**

### 7.2 Area step (location-first)

For city destinations, before showing hotels the site proposes one to three
neighbourhoods that suit the brief, each with a single sentence of reasoning,
and shows them on a map. The traveler can accept the suggestion (default),
pick another, or skip. This step is skipped automatically when the
destination is small or the traveler named an address to be near.
**(my call on the skip rules)**

Source of the suggestions **(my call)**: RateHawk's region and
point-of-interest data defines which areas exist and which hotels are in
them; the one-sentence description of each area's character comes from the AI
model's general knowledge. This is the one deliberate exception to the rule in
section 10 that AI claims must trace to supplied data. It is limited to
describing areas, never hotels, prices or policies, and is labelled as a
suggestion.

### 7.3 Three picks

One page, three hotels, each showing:

- Photos, name, star rating, review score.
- **Why it fits:** two or three short points tied to the brief.
- **The trade-off:** one honest drawback.
- The best-matching rate: room name and meal plan exactly as RateHawk sent
  them, the cancellation sentence (section 9), and the real price (section 8).

Below the three: "See all N hotels", which opens a conventional list with map,
sort and filters. This is the fallback, and it must be complete enough to pass
certification on its own.

A quality floor applies by default: 4 stars and above with a review score of
8.0 or higher. The traveler can relax it. If fewer than three hotels clear the
floor, the page shows the ones that do and says so plainly. Thresholds are
tunable. **(my call)**

Picks can be adjusted with one tap each: "cheaper", "closer to the centre",
"quieter", "show me three different ones". **(my call)**

### 7.4 Hotel page

Gallery, description, amenities, location map, review summary with the
category scores RateHawk provides (cleanliness, location, price, services,
room, meal, wifi, hygiene), hotel policies, and the rate list. Every rate
shows room name, bedding, meal plan, cancellation sentence, payment type and
the real price.

### 7.5 Checkout and confirmation

Guest details, a price breakdown that matches every earlier screen, the
cancellation sentence again, payment, then a confirmation page and email with
the booking reference. "My bookings" lets the traveler view and cancel.

Booking works with just an email address; creating an account is optional.
**(my call)**

Payment in the first build **(my call)**: build for the "deposit" model, where
we charge the traveler and then book with RateHawk, behind an interface that
does not depend on any one payment provider. Until a provider is chosen
(section 13), staging uses a test payment step. The order is: authorise
payment, book with RateHawk, capture on confirmation, release or refund
automatically if the booking fails.

"Done" for the first build **(my call)** means a staging site that completes
bookings against the RateHawk sandbox and is ready to submit for
certification. Taking real money is a later step that needs the payment
provider and production credentials.

### 7.6 Operations view

There is no support team yet **(Ali)**, so the common failures are handled
automatically:

- Booking fails or is not confirmed within the allowed time after payment:
  the payment is released or refunded in full and the traveler is emailed.
- Traveler cancels: the refund RateHawk reports, converted to selling-price
  terms, is returned and confirmed by email.
- Hotel-side cancellation or anything the system cannot resolve: the traveler
  is emailed that it is being looked at, and Ali is alerted.

A small private admin page **(my call)** lists bookings with their RateHawk
status, payments and refunds, so Ali can see and act on the alerted cases.

## 7.7 Coverage

Worldwide from day one: every hotel RateHawk offers. **(Ali)**

Consequences the builder must plan for: hotel content and reviews for the
whole catalogue are loaded from RateHawk's dump files and kept current with
the incremental dumps, so storage and sync cost are significant and should be
sized early against the real dump sizes. The area step (7.2) appears only for
destinations where the region data supports it; elsewhere the flow goes
straight to the picks. **(my call on both)**

## 8. Realistic prices (Ali)

How the price is made **(Ali)**: RateHawk supplies a net price and the portal
adds its own markup percentage. The percentage is a setting Ali controls and
can change without a code release; its starting value is still to be set
(section 13). Every amount the traveler sees is in selling-price terms: the
stay price, the cancellation sentence ("you lose $183"), the price-change
notice and refunds. The net price and markup are stored with each booking and
never shown to the traveler.

Because the selling price is ours, the first build shows no strike-through
prices at all. **(my call)**

- Every price shown is for the whole stay and includes all taxes and fees
  that are charged at booking.
- Amounts payable at the hotel are shown directly beside that price, on every
  screen, as a separate line ("+ $14 city tax at the hotel"). RateHawk
  requires non-included taxes to be shown separately and never added into the
  price, so this is both the honest design and the compliant one.
- A per-night figure may appear as secondary text only.
- If the price changes between the hotel page and booking (RateHawk's prebook
  step can return a different price), the traveler is told the old and new
  amount and must accept before paying.
- Currency: the traveler's chosen currency where RateHawk supports it,
  defaulting to USD. **(my call)**

## 9. Plain-English fine print

Each rate carries one sentence built from RateHawk's `cancellation_penalties`
data, for example: "Free to cancel until 27 June, 11:59 pm Dubai time. After
that you lose $183."

- This sentence is produced by ordinary code from the API fields, not by the
  AI model, so it can never be wrong about money. **(my call)**
- RateHawk sends deadlines in UTC. The site converts them and always names the
  time zone it is showing.
- The full structured policy stays one tap away.

## 10. How the AI is used

The AI chooses and explains. It never produces facts about price, room, meal
or cancellation; those are rendered from RateHawk data by code.

Pipeline for the three picks:

1. Turn the brief (and any free text) into structured preferences.
2. Resolve the destination to RateHawk region(s); run the area step.
3. Call RateHawk search for live prices and availability.
4. Narrow to a candidate set using the locally stored hotel content and review
   scores: quality floor, the "what matters" criteria, distance where known.
5. Ask the AI model to choose three from the candidates and write the "why it
   fits" points and the trade-off, using only the supplied hotel content,
   review scores and review text.
6. Check the output: each claim must trace to supplied data; otherwise drop
   the claim or the pick.

If the AI step fails or is slow, the page falls back to a rule-based top three
with shorter reasons, and the full list always works. **(my call)**

Build order **(my call)**: the conventional flow (search, list, hotel page,
checkout) is built first and must be certifiable on its own. The AI picks and
area step sit behind a switch. If RateHawk decides the AI features are a
separate product, the conventional flow is certified and launched first and
the AI features follow.

Model: current Claude models via the Claude API; the builder picks which model
handles which step. **(my call)**

## 11. RateHawk rules that shape the build

From ETG's integration guide, integration requirements, sandbox and
certification pages, read on 2026-11-11.

Booking sequence:

1. Search by region, by hotel IDs (up to 300) or by coordinates.
2. Hotel page request, only for a hotel the traveler has opened.
3. Prebook the chosen rate (recommended).
4. Create booking, start booking, then confirm through status polling or the
   booking-status webhook. A booking counts as confirmed only on status "ok" /
   "confirmed".
5. Cancel through the cancel endpoint; refund amounts come back in the
   response.

Content and caching:

- Hotel content (descriptions, photos, amenities, policies) must be copied
  into our own database and refreshed, preferably daily. The content API must
  not be called during a live search or booking.
- Reviews are fetched in bulk and stored the same way; they update twice a
  day. Real-time use of the reviews endpoint is not allowed.
- Hotel-page and prebook responses must not be cached. Search results may be
  cached only as approximate figures that are refreshed on the hotel page.
- Recommended timeouts: 30 seconds for search and hotel page, 60 for prebook.

Display rules checked in certification:

- Cancellation policy shown from their data.
- Non-included taxes shown separately.
- Room names shown as returned; never a better meal plan than they sent.
- Hotel policy fields (`metapolicy_struct`, `metapolicy_extra_info`) parsed
  and displayed.
- Residency sent on every search and hotel-page request.
- No placeholder guest data in bookings.

Certification: each product is certified separately, takes about 14 to 30
days, and needs the pre-certification checklist plus access to a working
staging site.

Sandbox: named test hotels cover taxes, all meal types, and 10% and 20%
prebook price increases. Card flows, 3-D Secure and "pay now" cannot be tested
there.

## 12. Later waves (outlined, not built now)

Wave 2:

- **Price-drop watch.** After booking a refundable rate, alert the traveler if
  the same stay gets cheaper. Alerts first; automatic rebooking only after
  alerts have proven reliable. Blocked on RateHawk's answer (section 13).
- **Group shortlist.** Share the three picks by link and let others vote.

Wave 3:

- **Ask the hotel anything.** Answer questions such as "is the wifi good
  enough for video calls?" from the stored review text and category scores.

The first build should store reviews and bookings in a way that does not need
reworking for these.

## 13. Open questions

For RateHawk (Denis):

1. Is automated price re-checking for an already-booked stay allowed, and
   through which endpoint?
2. Does an AI feature inside the website count as a separate "Chatbot" product
   for certification?
3. Which payment types does the contract include: deposit only, or also "now"
   and "pay at hotel"?

For Ali, later:

4. Payment provider. Under the "deposit" model we charge the traveler
   ourselves. The choice depends on answer 3 and on which providers the
   company can open an account with.
5. Brand name and visual identity.
6. The starting markup percentage, and whether RateHawk's contract places any
   limit on how selling prices are set or displayed.

Not yet confirmed from the docs: whether hotel content includes coordinates
and star rating (the area step and quality floor assume it does), and how many
reviews a typical hotel has.

## 14. How it gets made (my calls)

Ali's instruction: use the most robust languages and the ones that make the
site load as fast as possible. The choices below follow from that.

- Next.js with TypeScript. TypeScript is the most widely used typed language
  for the web; Next.js renders pages on the server so the browser receives
  ready-made HTML. React is also required by the Motion animation rule.
- Speed rules:
  - Pages are server-rendered; browser-side JavaScript is added only to the
    parts that are interactive (the brief, galleries, maps, checkout form).
  - The home page and hotel content pages are served from cache at the edge;
    only live prices are fetched per request.
  - The three-picks page streams: layout and hotel content appear at once,
    prices and AI reasons fill in as they arrive, with stable placeholders so
    nothing jumps.
  - Images are resized and served in modern formats, lazy-loaded below the
    first screen. Maps load only when scrolled to or opened.
  - Targets on a mid-range phone over 4G: Largest Contentful Paint under 2.0
    seconds, Interaction to Next Paint under 200 ms, Cumulative Layout Shift
    under 0.1, on the home, picks and hotel pages. Checked automatically on
    every build.
  - RateHawk search can take several seconds; that wait is shown as progress
    inside the page, never as a blank screen.
- Tailwind CSS with shadcn/ui components.
- Motion (`motion/react`) for all animation, per Ali's standing rule.
- Supabase for the database, accounts, bookings, and the stored hotel content
  and reviews, with scheduled jobs for the daily content and review sync.
- All RateHawk and Claude calls made from the server; credentials never reach
  the browser.
- Lives in its own folder, `~/Desktop/travel-portal`, with its own git
  repository. **(Ali agreed)**

## 15. Left to the builder

- Data model and sync job design.
- Which map provider to use.
- The exact "what matters" options per trip type.
- Visual design, within: calm, premium, uncluttered, strong type and
  photography, no promotional clutter.
- Email provider for confirmations.
- Test strategy, which must cover the RateHawk sandbox test cases.
