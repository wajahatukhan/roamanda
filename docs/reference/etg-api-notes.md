# ETG (RateHawk) B2B API v3: working notes

Collected from docs.emergingtravel.com on 2026-11-11. These are notes, not the
source of truth. Items marked (verify) were unclear or conflicting in the docs
and must be checked against the sandbox before code relies on them. Items
marked (settled) were checked against the sandbox recordings in
`tests/fixtures/etg/` (recorded 2026-11-11 by `scripts/record-fixtures.ts`).

## Sandbox findings (settled, 2026-11-11 recordings)

- Region search worked with region 2011 (first candidate): 30 hotels with `hotels_limit: 30`,
  `total_hotels: 30`. The fixture is trimmed to the first 22 hotels (66 rates) to stay under 300 KB.
- `multicomplete` for "Berlin" and "London" returns empty lists in the sandbox (it has a small
  dataset). "Paris" returns 5 hotels and region 2734 (`RT_CITY`, `FR`). The fixture uses "Paris".
- Hotel page fixtures: 10004834 has 18 rates, 8819557 has 12 rates. Stay recorded: check-in
  2026-12-11, 2 nights, 2 adults, residency `gb`, currency USD. Fixture dates are absolute and go
  stale; tests must not depend on today's date.
- Every payment type recorded (96 across SERP and hotel pages) has `type: "deposit"`, one
  payment type per rate. `now` and `hotel` were not seen in the sandbox.
- SERP rates carry `search_hash` and `match_hash`, but `search_hash` is `null` in all 66 recorded
  SERP rates. Hotel page rates carry `book_hash` (string) and `match_hash`, and no `search_hash`.
- `tax_data` is `{}` (no `taxes` key) when a rate has no taxes: all 66 SERP rates and all 12 rates of
  8819557. Only 10004834 has `taxes`. Parse a missing list as empty.
- Active on this key (from `overview`): `hotel/info/` (30 per 60 s), `content/v1/hotel_content_by_ids/`
  (30 per 60 s, not the 1200/min in the docs), `content/v1/hotel_reviews_by_ids/` (30 per 60 s),
  `content/v1/hotel_ids_by_filter/` and `filter_values/` (10 per 60 s), dumps (100 per day).
  Search limits: `search/serp/region` and `search/hp` 10 per 60 s, `multicomplete` 30 per 60 s,
  `serp/hotels` 150 per 60 s, `serp/geo` 10 per 60 s.


## Basics

- Sandbox host: `https://api-sandbox.ratehawk.com`. Production: `https://api.ratehawk.com`.
- B2B paths start `/api/b2b/v3/`. Content API paths start `/api/content/v1/`.
- Auth: HTTP Basic, username = key ID, password = API key.
- Envelope: `{ data, debug, status, error }`. Success: `status: "ok"`, `error: null`.
  Failure: `status: "error"`, `error: "<code>"`, `data: null`.
- HTTP errors: 400 `invalid_params` (detail in `debug.validation_error`), 403 auth
  and access codes, 429 `endpoint_exceeded_limit`, 5xx = retry with a cap.
- Rate limits are per endpoint per key. Headers: `X-RateLimit-SecondsNumber`,
  `X-RateLimit-RequestsNumber`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
  `GET /api/b2b/v3/overview/` lists each endpoint with `is_active`, `is_limited`,
  `requests_number`, `seconds_number`.
- Use numeric `hid` everywhere. String `id` is deprecated.
- Sandbox fixed values: language `en`, search currency USD, booking currency EUR.
  Sandbox region IDs: 2011, 2395, 2734, 6053839 (2011 verified to return hotels in a region search; 2734 was only seen as Paris in the multicomplete response, not searched). Feature hotels: 10004834
  (taxes, all meals), 8819557 (10% prebook increase), 9744270 (20% increase).
  No 3-D Secure or card flows in sandbox.
- Test key warning: hotel 8473727 on the test (not sandbox) key makes real bookings.

## Search

- Autocomplete: `POST /api/b2b/v3/search/multicomplete/` body `{ query, language? }`
  → `data.hotels[] { hid, name, region_id }`, `data.regions[] { id, name, type, country_code }` (max 5 each).
- By region: `POST /api/b2b/v3/search/serp/region/` with `region_id`.
- By hotels: `POST /api/b2b/v3/search/serp/hotels/` with `hids[]` (max 300).
- By geo: `POST /api/b2b/v3/search/serp/geo/` with `latitude`, `longitude`, `radius` (m, 1 to 70000).
- Common body: `checkin`, `checkout` (YYYY-MM-DD, checkin within 730 days, max 30
  nights), `residency` (ISO alpha-2), `guests[] { adults 1-6, children[] ages 0-17, max 4 }`
  (max 9 rooms), optional `currency`, `language`, `timeout`, `hotels_limit`,
  `filter { star_rating[], kind[], meal_type[], price_from, price_to }`.
- Response: `data.total_hotels`, `data.hotels[] { hid, rates[] }`.
- Hotel page: `POST /api/b2b/v3/search/hp/` body `{ hid, checkin, checkout, residency, guests[], currency?, language? }`.
  Same rate tree, with `book_hash` (valid 24 h) instead of `search_hash`.
  Call only for a hotel the traveler opened. Do not cache.
- ETG advises against letting users choose a rate straight from SERP data.

## Rate object

- `room_name`, `room_name_info.original_rate_name`,
  `room_data_trans { main_room_type, main_name, bathroom, bedding_type, misc_room_type }`.
- `meal_data { value, has_breakfast, no_child_meal }` (`meal` is deprecated; still sent). Values seen: `nomeal`, `breakfast`, `all-inclusive`. (settled)
- `daily_prices[]` (strings), `allotment`, `amenities_data[]`, `any_residency`, `is_package`, `match_hash`, `rg_ext`, `serp_filters[]`, `no_show`, `deposit`, `legal_info`, `bar_rate_price_data`. (settled)
- `room_name_info` is `null` in all recorded rates (not an object with `original_rate_name`). `room_data_trans.bedding_type` is `null` for 51 of 96 rates; `misc_room_type` can be `null`; `beds[]` is also sent. (settled)
- `payment_options.payment_types[]`:
  - `amount` + `currency_code`: what ETG charges, contract currency.
  - `show_amount` + `show_currency_code`: same figure in the requested currency.
  - `type`: `now` | `hotel` | `deposit`.
  - `tax_data.taxes[] { name, included_by_supplier, amount, currency_code }`. `taxes` is absent when
    there are none (`tax_data: {}`). Names seen: `city_tax`, `occupancy_tax`, `resort_fee`, `service_fee`.
    Of 72 recorded tax entries, 36 have `included_by_supplier: false` (city_tax and occupancy_tax, e.g.
    17.70 and 14.16 USD on a 354.00 USD stay) and 36 have `true` (resort_fee, service_fee). In that
    example `amount` (354.00) does not change with the taxes. The docs' reading that `false` means
    paid at the hotel is not contradicted but the sandbox data does not prove it. (settled for shape)
  - `vat_data { amount, applied, included, currency_code, value }`. (settled)
  - `cancellation_penalties.free_cancellation_before` (UTC, no offset, e.g. `2026-12-10T00:00:00`; null if none).
  - `cancellation_penalties.policies[] { start_at, end_at, amount_charge, amount_show, commission_info }`.
    Windows are contiguous: in all 96 payment types each window's `end_at` equals the next one's
    `start_at` (no gaps or overlaps). The first window always has `start_at: null` and the last
    `end_at: null`. (settled)
    `free_cancellation_before` equals the first window's `end_at` when the first window charges
    `0.00` and there is a second window (64 of 96). When free cancellation lasts to check-in there is
    a single window `{ start_at: null, end_at: null, amount_charge: "0.00" }` and
    `free_cancellation_before` is the check-in day at `00:00:00` (24 of 96, e.g. `2026-12-11T00:00:00`),
    so it does not match a window start in that case. Non-refundable rates have one window charging the
    full amount and `free_cancellation_before: null` (8 of 96). (settled)
  - `commission_info.{charge|show} { amount_gross, amount_net, amount_commission }` is present on every
    payment type (96 of 96) and also inside every cancellation policy window. (settled)
- Which figure is our net cost is not labelled in the docs. In the sandbox (USD search, USD
  contract) `amount`, `show_amount`, `commission_info.show.amount_net` and `.amount_gross` are
  identical in all 96 payment types and `amount_commission` is `0.00` throughout; `currency_code`
  equals `show_currency_code` throughout. Example (10004834, first rate, 2 nights): `amount`
  354.00, `show_amount` 354.00, `commission_info.charge` and `.show` gross 354.00 / net 354.00 /
  commission 0.00. The same rate's cancellation window has `amount_charge` 354.00 and its own
  `commission_info` with gross 393.33, net 354.00, commission 39.33 (354.00 / 0.9). So `amount_charge`
  and window `amount_net` match the payment-level `amount`, while window-level `amount_gross` is a
  different, higher figure. Working assumption stays: `show_amount` is what we owe ETG in the requested
  currency. Whether a non-USD contract or a production key changes `amount` vs `show_amount` is
  not covered by the sandbox. (verify with a non-USD request and with ETG)
- On request only: `sell_price_limits { min_price, max_price }`.

## Booking (Plan 2)

- Prebook: `POST /api/b2b/v3/hotel/prebook/` body `{ hash: book_hash, price_increase_percent? }`
  → `data.changes.price_changed`, `data.hotels[].rates[]` with a new `book_hash`.
  Errors: `no_available_rates`, `rate_not_found`, `prebook_disabled`, `contract_mismatch`.
- Form: `POST /api/b2b/v3/hotel/order/booking/form/` body `{ partner_order_id (UUID), book_hash, language, user_ip }`
  → `order_id`, `item_id`, `payment_types[]`, `is_gender_specification_required`. Valid 60 min.
  Retry with a new `partner_order_id`, max 10 times.
- Finish: `POST /api/b2b/v3/hotel/order/booking/finish/` body
  `{ language, partner { partner_order_id, amount_sell_b2b2c? }, payment_type { type, amount, currency_code }, rooms[].guests[] { first_name, last_name, is_child?, age? }, user { email, phone } }`.
- Status: `POST /api/b2b/v3/hotel/order/booking/finish/status/` body `{ partner_order_id }`
  → top-level `status`: `ok` | `processing` | `3ds` | `error`. Polling interval is
  stated as both 1 s and 5 s in the docs (verify).
- Webhook payload: `data { partner_order_id, status: completed|failed }`,
  `signature { signature, timestamp, token }`, HMAC-SHA256 of timestamp+token with the API key.
- Cancel: `POST /api/b2b/v3/hotel/order/cancel/` body `{ partner_order_id }`
  → `amount_payable`, `amount_refunded`, `amount_sell`.
- Orders: `POST /api/b2b/v3/hotel/order/info/`.
- Sandbox error simulation: `partner_order_id` suffixes such as `soldout`,
  `book_limit`, `provider`, `unknown_success`, `booking_form_expired`.

## Content

- Content API is "available upon request"; check `overview` to see if it is active on our key.
- Never call content endpoints during search, hotel page or booking.
- By IDs: `POST /api/content/v1/hotel_content_by_ids/` body `{ hids[] (max 100), language }`.
  Docs say 1200 requests/min; this sandbox key allows 30 per 60 s. `data` is an array of hotels (not
  keyed by hid); unknown hids are simply absent. Fields: `hid`, `name`, `address`, `latitude`,
  `longitude`, `kind`, `star_rating`, `region { id, name, type, country_code, iata }`,
  `check_in_time`, `check_out_time`, `amenity_groups[] { group_name, amenities[], non_free_amenities[] | null }`,
  `description_struct[] { title, paragraphs[] }`, `images_ext[] { category_slug, url }`,
  `room_groups[]`, `metapolicy_struct`, `metapolicy_extra_info`, `is_closed`, `deleted`. (settled)
  Also sent and not stored: `email`, `phone`, `postal_code`, `hotel_chain`, `facts`, `serp_filters`,
  `payment_methods`, `check_in_time_end`, `front_desk_time_start/end`, `keys_pickup`, `distance_center`,
  `star_certificate`, `policy_struct`, `is_gender_specification_required`, `id` (deprecated string id).
  Recorded 2026-11-11 in `tests/fixtures/etg/content-10004834.json` (one hotel) and
  `content-hotels.json` (the 22 hotels of the region 2011 search plus 10004834 and 8819557; not trimmed).
- Star rating: `star_rating` is an integer. Values seen across 24 hotels: 0, 2, 3, 4, 5 (8 of 24 are
  0). 0 means "no star rating" and maps to null; the mapper also nulls anything outside 1 to 5. (settled)
- Coordinates: `latitude` and `longitude` are JSON numbers (decimal degrees) on all 24 hotels. The mapper
  still treats them as optional (null gives no time zone). (settled)
- `is_closed` and `deleted` are both booleans, present on every hotel, `false` on all 24 recorded.
  The sync skips a hotel when either is `true` (not upserted, counted). (settled)
- Images: `images_ext[].url` is `https://cdn.worldota.net/t/{size}/content/<aa>/<bb>/<hash>.jpeg`,
  single host `cdn.worldota.net`, literal `{size}` in every URL (replace it, e.g. `640x350`, `1024x768`,
  `x220`). `category_slug` is `unspecified` on every image in the sandbox. Only 5 of 24 hotels have any
  images (11, 12, 28, 31, 50); the others have an empty list, so the UI needs a no-photo state. (settled)
- `metapolicy_struct` is an object of 14 keys on all 24 hotels: `add_fee`, `check_in_check_out`,
  `children`, `children_meal`, `cot`, `deposit`, `extra_bed`, `internet`, `meal`, `parking`, `pets`,
  `shuttle` (each an array of objects with `inclusion`, `price`, `currency` and a type or unit field, prices as
  strings) and `no_show` and `visa` (single objects, e.g. `no_show { availability, day_period, time }`,
  `visa { visa_support }`). The sandbox values look synthetic, so a production hotel may omit keys:
  stored as jsonb as received, read defensively. `metapolicy_extra_info` is free text, present on 4 of 24. (settled for shape)
- Reviews: `POST /api/content/v1/hotel_reviews_by_ids/` returns one row per hid with `rating` and
  `detailed_ratings` { cleanness, location, price, services, room, meal, wifi, hygiene }; in the sandbox
  every value is `null` and `reviews` is `[]` for all 24 hotels. `no_hotel_reviews` is treated as "no reviews".
- Static dictionaries: `GET /api/b2b/v3/hotel/static/` returns `data { beddings, meals, room_amenities, taxes,
  serp_filters, socket_types, amenity_translations }`; `taxes[]` and `meals[]` are `{ name, locale { en, de, ... } }`.
  11 tax names and 26 meal names, English under `locale.en`. 100 calls per day on this key. Recorded trimmed
  to English tax and meal names in `tests/fixtures/etg/static.json`.
- B2B single-hotel content endpoint also exists (page not read; path to confirm, verify).
- Hotel dump: `POST /api/b2b/v3/hotel/info/dump/` body `{ language, inventory? }`
  → `data.url` (valid about 1 h). Zstd, one JSON object per line. Weekly.
  Incremental: `/api/b2b/v3/hotel/info/incremental_dump/`, daily.
- Regions dump: `/api/b2b/v3/hotel/region/dump/` (GET or POST, verify). Fields: `id`,
  `name{lang}`, `type`, `country_code`, `center { latitude, longitude }`, `hids[]`, `iata`.
- Reviews by IDs (body `{ hids[], language }`): `rating` (0-10), `detailed_ratings { cleanness, location, price, services, room, meal, wifi, hygiene }`,
  `reviews[] { review_plus, review_minus, created, traveller_type, trip_type, rating, ... }`.
- Reviews dump: `POST /api/b2b/v3/hotel/reviews/dump/`. POI dump: `POST /api/b2b/v3/hotel/poi/dump`.
- Dictionaries: `GET /api/b2b/v3/hotel/static/`.
