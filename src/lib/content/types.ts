export type HotelImage = { category: string; url: string };
export type AmenityGroup = { groupName: string; amenities: string[]; nonFreeAmenities: string[] };
export type DescriptionSection = { title: string; paragraphs: string[] };
export type DetailedRatings = Record<string, number | null>;

/** A row of the `hotels` table, camelCase. */
export type Hotel = {
  hid: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** 1 to 5, or null when the hotel has no star rating (ETG sends 0). */
  starRating: number | null;
  kind: string | null;
  regionId: number | null;
  regionName: string | null;
  countryCode: string | null;
  timeZone: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  images: HotelImage[];
  amenityGroups: AmenityGroup[];
  description: DescriptionSection[];
  metapolicyStruct: Record<string, unknown> | null;
  metapolicyExtraInfo: string | null;
  reviewRating: number | null;
  reviewDetailed: DetailedRatings | null;
  syncedAt: string;
};

/** What a search-result card needs: a few columns, and at most the first photo. */
export type HotelCard = Pick<Hotel, "hid" | "name" | "address" | "starRating" | "reviewRating" | "images">;

export type Dictionaries = { taxNames: Record<string, string>; mealNames: Record<string, string> };
