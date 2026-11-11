export type Tax = { name: string; included_by_supplier: boolean; amount: string; currency_code: string };
export type CancellationPenalties = {
  free_cancellation_before: string | null;
  policies: { start_at: string | null; end_at: string | null; amount_charge: string; amount_show: string }[];
};
export type PaymentType = {
  amount: string; currency_code: string;
  show_amount: string; show_currency_code: string;
  type: "now" | "hotel" | "deposit";
  tax_data: { taxes: Tax[] };
  cancellation_penalties: CancellationPenalties;
};
