import { ALL_TURKISH_LOCATIONS, getLocationById, type TurkishLocation } from "@/data/turkish-locations";

const EARTH_RADIUS_KM = 6371;

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteCorridor {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** 0 = origin, 1 = destination */
export function getProgressAlongRoute(
  lat: number,
  lng: number,
  corridor: RouteCorridor
): number {
  const { originLat, originLng, destLat, destLng } = corridor;
  const dx = destLng - originLng;
  const dy = destLat - originLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((lng - originLng) * dx + (lat - originLat) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

export function distanceToRouteCorridorKm(
  lat: number,
  lng: number,
  corridor: RouteCorridor
): number {
  const { originLat, originLng, destLat, destLng } = corridor;
  const progress = getProgressAlongRoute(lat, lng, corridor);
  const closest = {
    lat: originLat + (destLat - originLat) * progress,
    lng: originLng + (destLng - originLng) * progress,
  };
  return haversineKm({ lat, lng }, closest);
}

export function isAlongRoute(
  lat: number,
  lng: number,
  corridor: RouteCorridor,
  maxDistanceKm = 70
): boolean {
  const progress = getProgressAlongRoute(lat, lng, corridor);
  if (progress < 0.02 || progress > 0.98) {
    return distanceToRouteCorridorKm(lat, lng, corridor) <= maxDistanceKm + 20;
  }
  return distanceToRouteCorridorKm(lat, lng, corridor) <= maxDistanceKm;
}

export function findCitiesAlongRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  options?: { maxCorridorKm?: number; limit?: number }
): TurkishLocation[] {
  const corridor: RouteCorridor = { originLat, originLng, destLat, destLng };
  const maxCorridorKm = options?.maxCorridorKm ?? 90;
  const limit = options?.limit ?? 6;

  const candidates = ALL_TURKISH_LOCATIONS.map((loc) => ({
    loc,
    progress: getProgressAlongRoute(loc.lat, loc.lng, corridor),
    distKm: distanceToRouteCorridorKm(loc.lat, loc.lng, corridor),
  }))
    .filter((c) => c.progress >= 0.1 && c.progress <= 0.9 && c.distKm <= maxCorridorKm)
    .sort((a, b) => a.progress - b.progress);

  const picked: TurkishLocation[] = [];
  for (const candidate of candidates) {
    const tooClose = picked.some(
      (existing) => haversineKm(existing, candidate.loc) < 60
    );
    if (!tooClose) {
      picked.push(candidate.loc);
    }
    if (picked.length >= limit) break;
  }

  return picked;
}

export function getRouteCityOptions(
  originId: string,
  destinationId: string
): { intermediate: TurkishLocation[]; destination: TurkishLocation | undefined } {
  const origin = getLocationById(originId);
  const destination = getLocationById(destinationId);
  if (!origin || !destination) {
    return { intermediate: [], destination };
  }

  const intermediate = findCitiesAlongRoute(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  ).filter((city) => city.id !== originId && city.id !== destinationId);

  return { intermediate, destination };
}

export function resolveCityLocations(cityIds: string[]): TurkishLocation[] {
  return cityIds
    .map((id) => getLocationById(id))
    .filter((loc): loc is TurkishLocation => Boolean(loc));
}

export function getMidRouteCity(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): TurkishLocation | null {
  const cities = findCitiesAlongRoute(originLat, originLng, destLat, destLng, { limit: 8 });
  if (cities.length === 0) return null;
  return cities[Math.floor(cities.length / 2)];
}

export function sortByRouteProgress<T extends RoutePoint>(
  items: T[],
  corridor: RouteCorridor
): T[] {
  return [...items].sort(
    (a, b) =>
      getProgressAlongRoute(a.lat, a.lng, corridor) -
      getProgressAlongRoute(b.lat, b.lng, corridor)
  );
}

export function filterAlongRoute<T extends RoutePoint>(
  items: T[],
  corridor: RouteCorridor,
  maxDistanceKm = 70
): T[] {
  return items.filter((item) => isAlongRoute(item.lat, item.lng, corridor, maxDistanceKm));
}
