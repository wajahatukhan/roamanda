import { z } from "zod";

/** Non-negative decimal as ETG sends money: digits with an optional fractional part. */
export const DecimalString = z.string().regex(/^\d+(\.\d+)?$/);

// Non-strict objects: unknown fields are tolerated, and fields this app does not use are omitted.
// Shapes were checked against sandbox recordings in tests/fixtures/etg/.

export const Guests = z.array(z.object({ adults: z.number().int(), children: z.array(z.number().int()) }));
export type Guests = z.infer<typeof Guests>;

export const StayQuery = z.object({
  checkin: z.string(),
  checkout: z.string(),
  residency: z.string(),
  guests: Guests,
  currency: z.string(),
});
export type StayQuery = z.infer<typeof StayQuery>;

export const Tax = z.object({
  name: z.string(),
  included_by_supplier: z.boolean(),
  amount: DecimalString,
  currency_code: z.string(),
});
export type Tax = z.infer<typeof Tax>;

export const CancellationPenalties = z.object({
  free_cancellation_before: z.string().nullable(),
  policies: z.array(
    z.object({
      start_at: z.string().nullable(),
      end_at: z.string().nullable(),
      amount_charge: DecimalString,
      amount_show: DecimalString,
    }),
  ),
});
export type CancellationPenalties = z.infer<typeof CancellationPenalties>;

export const PaymentType = z.object({
  amount: DecimalString,
  currency_code: z.string(),
  show_amount: DecimalString,
  show_currency_code: z.string(),
  type: z.enum(["now", "hotel", "deposit"]),
  // The sandbox sends tax_data as {} when a rate has no taxes, so a missing list becomes [].
  tax_data: z.object({ taxes: z.array(Tax).default([]) }),
  cancellation_penalties: CancellationPenalties,
});
export type PaymentType = z.infer<typeof PaymentType>;

export const Rate = z.object({
  // Hotel page rates carry book_hash. SERP rates carry search_hash, which the sandbox returns as null.
  book_hash: z.string().nullish(),
  search_hash: z.string().nullish(),
  room_name: z.string(),
  room_data_trans: z.object({
    main_name: z.string(),
    bedding_type: z.string().nullable(),
    misc_room_type: z.string().nullable(),
  }),
  meal_data: z.object({ value: z.string(), has_breakfast: z.boolean() }),
  amenities_data: z.array(z.string()),
  payment_options: z.object({ payment_types: z.array(PaymentType).min(1) }),
});
export type Rate = z.infer<typeof Rate>;

export const MulticompleteData = z.object({
  hotels: z.array(z.object({ hid: z.number(), name: z.string(), region_id: z.number() })),
  regions: z.array(z.object({ id: z.number(), name: z.string(), type: z.string(), country_code: z.string() })),
});
export type MulticompleteData = z.infer<typeof MulticompleteData>;

export const SearchRegionData = z.object({
  hotels: z.array(z.object({ hid: z.number(), rates: z.array(Rate) })),
});
export type SearchRegionData = z.infer<typeof SearchRegionData>;

export const HotelPageData = z.object({
  hotels: z.array(z.object({ hid: z.number(), rates: z.array(Rate) })),
});
export type HotelPageData = z.infer<typeof HotelPageData>;
