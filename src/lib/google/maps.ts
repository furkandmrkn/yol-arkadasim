import {
  ALL_TURKISH_LOCATIONS,
  getLocationById,
  type TurkishLocation,
} from "@/data/turkish-locations";
import { findCitiesAlongRoute } from "@/lib/route-utils";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!GOOGLE_API_KEY) {
    return mockGeocode(address);
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", `${address}, Türkiye`);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("language", "tr");
  url.searchParams.set("region", "tr");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.[0]) {
    return mockGeocode(address);
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

function mockGeocode(address: string): GeocodingResult {
  const normalized = address.toLowerCase().replace(/[^a-zçğıöşü]/gi, "");

  const byId = getLocationById(normalized);
  if (byId) {
    return {
      lat: byId.lat,
      lng: byId.lng,
      formattedAddress: `${byId.label}, Türkiye`,
    };
  }

  for (const loc of ALL_TURKISH_LOCATIONS) {
    const labelKey = loc.label.toLowerCase().replace(/[^a-zçğıöşü]/gi, "");
    if (normalized.includes(labelKey) || labelKey.includes(normalized)) {
      return {
        lat: loc.lat,
        lng: loc.lng,
        formattedAddress: `${loc.label}, Türkiye`,
      };
    }
  }

  return { lat: 39.0, lng: 35.0, formattedAddress: `${address}, Türkiye` };
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
  photoUrls?: string[];
  googleMapsUrl?: string;
  websiteUrl?: string;
  types: string[];
  priceLevel?: number;
  reviews?: { text: string; rating: number; author: string }[];
}

const PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.priceLevel,places.photos,places.googleMapsUri,places.websiteUri";

export function buildGoogleMapsPlaceUrl(placeId: string, name?: string): string {
  const query = encodeURIComponent(name ?? "Konum");
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(placeId)}`;
}

export async function searchPlacesNearby(
  lat: number,
  lng: number,
  query: string,
  radius = 50000
): Promise<PlaceSearchResult[]> {
  if (!GOOGLE_API_KEY) {
    return mockPlaces(query, lat, lng);
  }

  const newApiPlaces = await searchPlacesNewApi(lat, lng, query, radius);
  if (newApiPlaces.length > 0) {
    return newApiPlaces;
  }

  const legacyPlaces = await searchPlacesLegacyApi(lat, lng, query, radius);
  if (legacyPlaces.length > 0) {
    return legacyPlaces;
  }

  return mockPlaces(query, lat, lng);
}

async function searchPlacesNewApi(
  lat: number,
  lng: number,
  query: string,
  radius: number
): Promise<PlaceSearchResult[]> {
  const url = new URL("https://places.googleapis.com/v1/places:searchText");
  const body = {
    textQuery: `${query} Türkiye`,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    languageCode: "tr",
    maxResultCount: 10,
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY!,
      "X-Goog-FieldMask": PLACES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Places API (New) error ${res.status}:`, errorText.slice(0, 300));
    return [];
  }

  const data = await res.json();
  return (data.places ?? []).map((p: Record<string, unknown>) => mapPlace(p));
}

async function searchPlacesLegacyApi(
  lat: number,
  lng: number,
  query: string,
  radius: number
): Promise<PlaceSearchResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", `${query} Türkiye`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("language", "tr");
  url.searchParams.set("key", GOOGLE_API_KEY!);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error(
      `Places API (Legacy) error: ${data.status}`,
      data.error_message ?? ""
    );
    return [];
  }

  return (data.results ?? []).map((place: Record<string, unknown>) => mapLegacyPlace(place));
}

export async function searchPlacesAtPoints(
  queries: string[],
  searchPoints: { lat: number; lng: number; radius?: number }[]
): Promise<PlaceSearchResult[]> {
  const results: PlaceSearchResult[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    for (const point of searchPoints) {
      const places = await searchPlacesNearby(
        point.lat,
        point.lng,
        query,
        point.radius ?? 45000
      );
      for (const place of places) {
        if (!seen.has(place.placeId)) {
          seen.add(place.placeId);
          results.push(place);
        }
      }
    }
  }

  return results;
}

export async function searchPlacesAlongRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  queries: string[],
  exploreMode = false
): Promise<PlaceSearchResult[]> {
  const searchPoints: { lat: number; lng: number; radius: number }[] = [];

  if (exploreMode) {
    const corridorCities = findCitiesAlongRoute(originLat, originLng, destLat, destLng);
    for (const city of corridorCities) {
      searchPoints.push({ lat: city.lat, lng: city.lng, radius: 45000 });
    }
    if (searchPoints.length === 0) {
      const fractions = [0.25, 0.5, 0.75];
      for (const f of fractions) {
        searchPoints.push({
          lat: originLat + (destLat - originLat) * f,
          lng: originLng + (destLng - originLng) * f,
          radius: 50000,
        });
      }
    }
    searchPoints.push({ lat: destLat, lng: destLng, radius: 40000 });
  } else {
    searchPoints.push({ lat: destLat, lng: destLng, radius: 50000 });
    searchPoints.push({
      lat: (originLat + destLat) / 2,
      lng: (originLng + destLng) / 2,
      radius: 50000,
    });
  }

  return searchPlacesAtPoints(queries, searchPoints);
}

export async function searchLodging(
  lat: number,
  lng: number,
  lodgingType?: string,
  options?: {
    queryVariant?: number;
    amenities?: {
      pool?: boolean;
      family?: boolean;
      parking?: boolean;
    };
  }
): Promise<PlaceSearchResult[]> {
  const queries = buildLodgingQueries(lodgingType, options);
  const results: PlaceSearchResult[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const places = await searchPlacesNearby(lat, lng, query, 35000);
    for (const place of places) {
      if (!seen.has(place.placeId)) {
        seen.add(place.placeId);
        results.push(place);
      }
    }
  }

  return results;
}

export async function searchLodgingAtPoints(
  points: { lat: number; lng: number; cityLabel?: string }[],
  lodgingType?: string,
  options?: {
    queryVariant?: number;
    amenities?: {
      pool?: boolean;
      family?: boolean;
      parking?: boolean;
    };
  }
): Promise<PlaceSearchResult[]> {
  const all: PlaceSearchResult[] = [];
  const seen = new Set<string>();

  for (const point of points) {
    const places = await searchLodging(point.lat, point.lng, lodgingType, options);
    for (const place of places) {
      if (!seen.has(place.placeId)) {
        seen.add(place.placeId);
        all.push(place);
      }
    }
  }

  return all;
}

function buildLodgingQueries(
  lodgingType?: string,
  options?: {
    queryVariant?: number;
    amenities?: {
      pool?: boolean;
      family?: boolean;
      parking?: boolean;
    };
  }
): string[] {
  const base =
    lodgingType === "PENSION"
      ? "pansiyon"
      : lodgingType === "APART"
        ? "apart otel"
        : lodgingType === "HOTEL"
          ? "otel"
          : "konaklama";

  const variants = [base, `${base} butik`, `${base} merkez`, `${base} resort`, `konaklama ${base}`];
  const variantIndex = options?.queryVariant ?? 0;
  const queries = [
    variants[variantIndex % variants.length],
    `${base} ${variantIndex % 2 === 0 ? "popüler" : "önerilen"}`,
  ];

  if (options?.amenities?.pool) {
    queries.push(`${base} spa havuz`);
  }
  if (options?.amenities?.family) {
    queries.push(`${base} aile`);
  }
  if (options?.amenities?.parking) {
    queries.push(`${base} otopark`);
  }

  return Array.from(new Set(queries));
}

function mapPlace(p: Record<string, unknown>): PlaceSearchResult {
  const location = p.location as { latitude: number; longitude: number };
  const displayName = p.displayName as { text: string };
  const name = displayName?.text ?? "Bilinmeyen";
  const placeId = (p.id as string) ?? crypto.randomUUID();
  const photos = p.photos as { name: string }[] | undefined;
  const photoUrls =
    photos
      ?.slice(0, 4)
      .map(
        (photo) =>
          `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=400&key=${GOOGLE_API_KEY}`
      ) ?? [];

  return {
    placeId,
    name,
    lat: location.latitude,
    lng: location.longitude,
    address: p.formattedAddress as string | undefined,
    rating: p.rating as number | undefined,
    reviewCount: p.userRatingCount as number | undefined,
    photoUrl: photoUrls[0],
    photoUrls,
    googleMapsUrl: (p.googleMapsUri as string | undefined) ?? buildGoogleMapsPlaceUrl(placeId, name),
    websiteUrl: p.websiteUri as string | undefined,
    types: (p.types as string[]) ?? [],
    priceLevel: p.priceLevel as number | undefined,
  };
}

function mapLegacyPlace(p: Record<string, unknown>): PlaceSearchResult {
  const geometry = p.geometry as { location: { lat: number; lng: number } };
  const photos = p.photos as { photo_reference: string }[] | undefined;
  const placeId = (p.place_id as string) ?? crypto.randomUUID();
  const name = (p.name as string) ?? "Bilinmeyen";
  const photoUrls =
    photos
      ?.slice(0, 4)
      .map(
        (photo) =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
      ) ?? [];

  return {
    placeId,
    name,
    lat: geometry.location.lat,
    lng: geometry.location.lng,
    address: p.formatted_address as string | undefined,
    rating: p.rating as number | undefined,
    reviewCount: p.user_ratings_total as number | undefined,
    photoUrl: photoUrls[0],
    photoUrls,
    googleMapsUrl: buildGoogleMapsPlaceUrl(placeId, name),
    types: (p.types as string[]) ?? [],
    priceLevel: p.price_level as number | undefined,
  };
}

function findNearestLocation(lat: number, lng: number): TurkishLocation | undefined {
  let nearest: TurkishLocation | undefined;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const loc of ALL_TURKISH_LOCATIONS) {
    const distance = Math.hypot(loc.lat - lat, loc.lng - lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = loc;
    }
  }

  return nearest;
}

function mockPlaces(query: string, lat: number, lng: number): PlaceSearchResult[] {
  const nearest = findNearestLocation(lat, lng);
  const city = nearest?.label ?? "Bölge";
  const base = [
    {
      placeId: `mock-${nearest?.id ?? "region"}-1`,
      name: `${city} Müzesi`,
      lat: lat + 0.05,
      lng: lng + 0.03,
      address: city,
      rating: 4.7,
      reviewCount: 12500,
      types: ["museum", "tourist_attraction"],
      reviews: [
        {
          text: `${city} bölgesinin en çok ziyaret edilen müzesi, mutlaka görülmeli.`,
          rating: 5,
          author: "Ayşe K.",
        },
      ],
    },
    {
      placeId: `mock-${nearest?.id ?? "region"}-2`,
      name: `${city} Tarihi Merkez`,
      lat: lat + 0.02,
      lng: lng - 0.02,
      address: city,
      rating: 4.5,
      reviewCount: 8200,
      types: ["tourist_attraction"],
      reviews: [
        {
          text: "Tarihi sokakları ve manzarası gezmeye değer.",
          rating: 5,
          author: "Mehmet Y.",
        },
      ],
    },
    {
      placeId: `mock-${nearest?.id ?? "region"}-3`,
      name: `${city} Kültür Parkı`,
      lat: lat - 0.04,
      lng: lng + 0.01,
      address: city,
      rating: 4.6,
      reviewCount: 9800,
      types: ["tourist_attraction"],
      reviews: [
        {
          text: "Aileler için keyifli bir gezi noktası.",
          rating: 4,
          author: "Zeynep A.",
        },
      ],
    },
    {
      placeId: `mock-${nearest?.id ?? "region"}-4`,
      name: `${city} El Sanatları Çarşısı`,
      lat: lat + 0.01,
      lng: lng + 0.04,
      address: city,
      rating: 4.4,
      reviewCount: 2100,
      types: ["tourist_attraction", "store"],
      reviews: [
        {
          text: "Yerel ürünler ve el yapımı hediyelik eşyalar bulabilirsiniz.",
          rating: 5,
          author: "Can D.",
        },
      ],
    },
    {
      placeId: `mock-${nearest?.id ?? "region"}-5`,
      name: `${city} Lezzet Durağı`,
      lat: lat + 0.03,
      lng: lng + 0.02,
      address: city,
      rating: 4.8,
      reviewCount: 3400,
      types: ["restaurant"],
      reviews: [
        {
          text: "Yerel mutfağın en iyi örneklerini sunuyor.",
          rating: 5,
          author: "Elif S.",
        },
      ],
    },
    {
      placeId: `mock-${nearest?.id ?? "region"}-lodging-1`,
      name: `${city} Boutique Otel`,
      lat: lat + 0.02,
      lng: lng + 0.01,
      address: city,
      rating: 4.6,
      reviewCount: 4500,
      types: ["lodging"],
      priceLevel: 3,
      reviews: [
        {
          text: "Konforlu odalar ve merkezi konum.",
          rating: 5,
          author: "Deniz T.",
        },
      ],
    },
    {
      placeId: `mock-${nearest?.id ?? "region"}-lodging-2`,
      name: `${city} Panorama Pansiyon`,
      lat: lat + 0.01,
      lng: lng - 0.01,
      address: city,
      rating: 4.3,
      reviewCount: 890,
      types: ["lodging"],
      priceLevel: 2,
      reviews: [
        {
          text: "Uygun fiyatlı, temiz ve merkezi konum.",
          rating: 4,
          author: "Burak H.",
        },
      ],
    },
  ];

  const q = query.toLowerCase();
  if (q.includes("otel") || q.includes("pansiyon") || q.includes("apart")) {
    return base.filter((p) => p.types.includes("lodging"));
  }
  if (q.includes("restoran") || q.includes("yemek")) {
    return base.filter((p) => p.types.includes("restaurant"));
  }
  return base.filter((p) => !p.types.includes("lodging"));
}

export interface DirectionsResult {
  legs: {
    from: string;
    to: string;
    distanceText: string;
    durationText: string;
    durationMinutes: number;
  }[];
  totalDistanceText: string;
  totalDurationText: string;
  polyline: string;
}

export async function getDirections(
  origin: string,
  destination: string,
  waypoints: { lat: number; lng: number }[] = [],
  mode: "driving" | "walking" | "transit" = "driving"
): Promise<DirectionsResult | null> {
  if (!GOOGLE_API_KEY) {
    return mockDirections(origin, destination, waypoints);
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", mode);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("language", "tr");

  if (waypoints.length > 0) {
    const wp = waypoints.map((w) => `${w.lat},${w.lng}`).join("|");
    url.searchParams.set("waypoints", wp);
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !data.routes?.[0]) {
    return mockDirections(origin, destination, waypoints);
  }

  const route = data.routes[0];
  const legs = route.legs.map(
    (leg: {
      start_address: string;
      end_address: string;
      distance: { text: string };
      duration: { text: string; value: number };
    }) => ({
      from: leg.start_address,
      to: leg.end_address,
      distanceText: leg.distance.text,
      durationText: leg.duration.text,
      durationMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
    })
  );

  let totalDistance = 0;
  let totalDuration = 0;
  for (const leg of route.legs) {
    totalDistance += leg.distance.value;
    totalDuration += leg.duration.value;
  }

  return {
    legs,
    totalDistanceText: `${(totalDistance / 1000).toFixed(0)} km`,
    totalDurationText: `${Math.round(totalDuration / 3600)} saat ${Math.round((totalDuration % 3600) / 60)} dk`,
    polyline: route.overview_polyline.points,
  };
}

function mockDirections(
  origin: string,
  destination: string,
  waypoints: { lat: number; lng: number }[]
): DirectionsResult {
  const stopCount = waypoints.length;
  return {
    legs: [
      {
        from: origin,
        to: waypoints[0] ? "Durak 1" : destination,
        distanceText: "120 km",
        durationText: "1 saat 30 dk",
        durationMinutes: 90,
      },
      ...(waypoints.length > 1
        ? waypoints.slice(1).map((_, idx) => ({
            from: `Durak ${idx + 1}`,
            to: idx === waypoints.length - 2 ? destination : `Durak ${idx + 2}`,
            distanceText: "80 km",
            durationText: "1 saat",
            durationMinutes: 60,
          }))
        : waypoints.length === 1
          ? [
              {
                from: "Durak 1",
                to: destination,
                distanceText: "80 km",
                durationText: "1 saat",
                durationMinutes: 60,
              },
            ]
          : []),
    ],
    totalDistanceText: `${200 + stopCount * 20} km`,
    totalDurationText: `${3 + stopCount} saat`,
    polyline: "",
  };
}
