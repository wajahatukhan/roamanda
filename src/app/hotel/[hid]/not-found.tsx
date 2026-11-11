import { HotelMissing } from "@/components/hotel-missing";

/** The page's own fallback when a hotel turns out to be missing after streaming has begun (status stays 200 then; proxy.ts answers 404 first). */
export default function HotelNotFound() {
  return <HotelMissing />;
}
