export type DestinationRegion = { id: number; name: string; type: string; countryCode: string };
export type DestinationHotel = { hid: number; name: string };
export type DestinationsResponse = { regions: DestinationRegion[]; hotels: DestinationHotel[]; error?: "unavailable" };

export const MIN_QUERY_LENGTH = 2;
