# ETG (RateHawk) B2B API v3: working notes

Collected from docs.emergingtravel.com on 2026-11-11. These are notes, not the
source of truth. Items marked (verify) were unclear or conflicting in the docs
and must be checked against the sandbox before code relies on them.

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
  Sandbox region IDs: 2011, 2395, 2734, 6053839. Feature hotels: 10004834
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
- `meal_data { value, has_breakfast, no_child_meal }` (`meal` is deprecated).
- `daily_prices[]`, `allotment`, `amenities_data[]`, `any_residency`, `is_package`.
- `payment_options.payment_types[]`:
  - `amount` + `currency_code`: what ETG charges, contract currency.
  - `show_amount` + `show_currency_code`: same figure in the requested currency.
  - `type`: `now` | `hotel` | `deposit`.
  - `tax_data.taxes[] { name, included_by_supplier, amount, currency_code }`.
    `included_by_supplier: false` means paid at the hotel.
  - `vat_data { amount, applied, included, currency_code }`.
  - `cancellation_penalties.free_cancellation_before` (UTC, null if none).
  - `cancellation_penalties.policies[] { start_at, end_at, amount_charge, amount_show }`.
  - `commission_info.{charge|show} { amount_gross, amount_net, amount_commission }`.
- Which figure is our net cost is not labelled in the docs (verify with ETG and
  against sandbox responses). Working assumption: `show_amount` is what we owe
  ETG, expressed in the requested currency.
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
- By IDs: `POST /api/content/v1/hotel_content_by_ids/` body `{ hids[] (max 100), language }`,
  1200 requests/min. Fields: `hid`, `name`, `address`, `latitude`, `longitude`,
  `kind`, `star_rating` (0 = none) (verify), `region { id, name, type, country_code }`,
  `check_in_time`, `check_out_time`, `amenity_groups[] { group_name, amenities[], non_free_amenities[] }`,
  `description_struct[] { title, paragraphs[] }`, `images_ext[] { category_slug, url }`
  (URL contains `{size}`; sizes include `1024x768`, `640x350`, `x220`, `1080x`, `1920x1080`),
  `room_groups[]`, `metapolicy_struct`, `metapolicy_extra_info`, `is_closed`, `deleted` (verify).
- B2B single-hotel content endpoint also exists (page not read; path to confirm, verify).
- Hotel dump: `POST /api/b2b/v3/hotel/info/dump/` body `{ language, inventory? }`
  → `data.url` (valid about 1 h). Zstd, one JSON object per line. Weekly.
  Incremental: `/api/b2b/v3/hotel/info/incremental_dump/`, daily.
- Regions dump: `/api/b2b/v3/hotel/region/dump/` (GET or POST, verify). Fields: `id`,
  `name{lang}`, `type`, `country_code`, `center { latitude, longitude }`, `hids[]`, `iata`.
- Reviews by IDs: `POST /api/content/v1/hotel_reviews_by_ids/` body `{ hids[], language }`
  → `rating` (0-10), `detailed_ratings { cleanness, location, price, services, room, meal, wifi, hygiene }`,
  `reviews[] { review_plus, review_minus, created, traveller_type, trip_type, rating, ... }`.
- Reviews dump: `POST /api/b2b/v3/hotel/reviews/dump/`. POI dump: `POST /api/b2b/v3/hotel/poi/dump`.
- Dictionaries: `GET /api/b2b/v3/hotel/static/`.
