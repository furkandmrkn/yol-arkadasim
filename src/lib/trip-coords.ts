import { resolveLocationCoords } from "@/data/turkish-locations";
import { geocodeAddress, type GeocodingResult } from "@/lib/google/maps";

export async function resolveTripCoordinates(
  nameOrId: string
): Promise<GeocodingResult | null> {
  const known = resolveLocationCoords(nameOrId);
  if (known) {
    return {
      lat: known.lat,
      lng: known.lng,
      formattedAddress: `${known.label}, Türkiye`,
    };
  }
  return geocodeAddress(nameOrId);
}
