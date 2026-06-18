import type { TripWizardData, PoiRecommendation, WeatherSummary } from "@/types/trip";
import type { PlaceSearchResult } from "@/lib/google/maps";
import { POI_CATEGORIES } from "@/types/trip";
import { getIntensityStopCount } from "@/lib/utils";
import { getWeatherTagForPoi } from "@/lib/weather";
import {
  type RouteCorridor,
  type RoutePoint,
  getProgressAlongRoute,
  haversineKm,
  isAlongRoute,
} from "@/lib/route-utils";

const INDOOR_CATEGORIES = new Set(["museum", "cave", "historic", "food", "shopping", "thermal"]);
const OUTDOOR_CATEGORIES = new Set(["nature", "beach"]);

const LODGING_AMENITY_KEYWORDS: Record<string, string[]> = {
  BREAKFAST: ["kahvalt"],
  POOL: ["havuz", "spa", "wellness"],
  FAMILY: ["aile", "çocuk", "family"],
  PARKING: ["otopark", "park yeri", "parking"],
};

const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  museum: "müze",
  cave: "mağara",
  nature: "doğa park",
  beach: "plaj",
  historic: "tarihi yer",
  food: "restoran",
  shopping: "alışveriş merkezi",
  thermal: "termal otel spa",
};

const FOOD_TYPES = new Set(["restaurant", "cafe", "bakery", "meal_takeaway", "bar"]);
const NATURE_TYPES = new Set(["park", "natural_feature", "campground", "national_park"]);

function foldTr(value: string): string {
  return value
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase();
}

/** Şehir etiketlerinden adres eşleştirmede kullanılacak anahtarlar üretir (ör. "Kocaeli (İzmit)" → "kocaeli"). */
export function buildCityMatchKeys(labels: string[]): string[] {
  return labels
    .map((label) => foldTr(label.split("(")[0].trim()))
    .filter((key) => key.length > 0);
}

/** Önerilen yerin adresi seçilen şehirlerden birini içeriyor mu? Adres yoksa (şehir merkezli arama yapıldığı için) korunur. */
function addressMatchesCities(address: string | undefined, cityKeys: string[]): boolean {
  if (cityKeys.length === 0) return true;
  if (!address) return true;
  const folded = foldTr(address);
  return cityKeys.some((key) => folded.includes(key));
}

export function scorePlace(
  place: PlaceSearchResult,
  category: string,
  wizard: TripWizardData,
  weather?: WeatherSummary
): number {
  let score = 50;

  if (place.rating) score += (place.rating - 3) * 15;
  if (place.reviewCount) score += Math.min(place.reviewCount / 500, 15);

  if (wizard.childrenAges.length > 0 || wizard.hasBaby) {
    if (["museum", "nature", "beach"].includes(category)) score += 10;
    if (category === "cave") score += 5;
  }

  if (wizard.budget === "BUDGET" && (place.priceLevel ?? 0) <= 2) score += 8;
  if (wizard.budget === "LUXURY" && (place.priceLevel ?? 0) >= 3) score += 8;

  if (wizard.localVsTourist > 70 && (place.reviewCount ?? 0) < 3000) score += 10;
  if (wizard.localVsTourist < 30 && (place.reviewCount ?? 0) > 5000) score += 10;

  if (weather?.isRainy) {
    if (INDOOR_CATEGORIES.has(category)) score += 20;
    if (OUTDOOR_CATEGORIES.has(category)) score -= 25;
  }

  if (weather?.isHot) {
    if (["cave", "museum", "thermal"].includes(category)) score += 15;
    if (category === "beach") score += 10;
  }

  if (wizard.pace === "RELAXED") score += place.reviewCount && place.reviewCount > 8000 ? -5 : 5;
  if (wizard.pace === "PACKED" && (place.rating ?? 0) >= 4.5) score += 5;

  if (category === "food") {
    const servesAlcohol = place.types.includes("bar") || place.types.includes("night_club");
    if (wizard.foodPreferences.includes("İçkili (alkollü) mekan")) {
      score += servesAlcohol ? 12 : -4;
    }
    if (wizard.foodPreferences.includes("İçkisiz (alkolsüz) mekan")) {
      score += servesAlcohol ? -12 : 6;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function buildSearchQueries(
  wizard: TripWizardData,
  variant = 0,
  routeCityNames: string[] = []
): string[] {
  const queries: string[] = [];
  const dest = wizard.destination;
  const cities =
    wizard.exploreMode && routeCityNames.length > 0 ? routeCityNames : [dest];

  if (wizard.exploreMode && wizard.categories.length > 0) {
    for (const city of cities) {
      for (const catId of wizard.categories) {
        const term = CATEGORY_SEARCH_TERMS[catId] ?? POI_CATEGORIES.find((c) => c.id === catId)?.label;
        if (term) {
          queries.push(`${city} ${term}`);
        }
      }
    }
    if (variant > 0) {
      for (const city of cities.slice(0, 2)) {
        queries.push(`${city} gezilecek yerler`);
      }
    }
  } else {
    const variantSets = [
      [`${dest} turistik yerler`, `${dest} meşhur restoranlar`],
      [`${dest} gezilecek yerler`, `${dest} popüler mekanlar`],
      [`${dest} tarihi mekanlar`, `${dest} doğa gezisi`],
      [`${dest} müze`, `${dest} yerel restoran`],
    ];
    queries.push(...variantSets[variant % variantSets.length]);
  }

  const foodCity = cities[Math.floor(cities.length / 2)] ?? dest;
  if (wizard.foodPreferences.includes("Yerel mutfak")) {
    queries.push(`${foodCity} yerel yemek restoran`);
  }
  if (wizard.foodPreferences.includes("İçkili (alkollü) mekan")) {
    queries.push(`${foodCity} içkili restoran meyhane`);
  }
  if (wizard.foodPreferences.includes("İçkisiz (alkolsüz) mekan")) {
    queries.push(`${foodCity} alkolsüz aile restoranı`);
  }

  return queries.slice(0, 12);
}

function classifyPlaceCategory(place: PlaceSearchResult, selectedCategories: string[]): string {
  const types = new Set(place.types);

  if (place.types.some((t) => FOOD_TYPES.has(t)) && selectedCategories.includes("food")) {
    return "food";
  }
  if (types.has("museum") && selectedCategories.includes("museum")) {
    return "museum";
  }
  if (place.types.some((t) => NATURE_TYPES.has(t)) && selectedCategories.includes("nature")) {
    return "nature";
  }
  if (types.has("shopping_mall") && selectedCategories.includes("shopping")) {
    return "shopping";
  }
  if (types.has("spa") && selectedCategories.includes("thermal")) {
    return "thermal";
  }

  for (const catId of selectedCategories) {
    const cat = POI_CATEGORIES.find((c) => c.id === catId);
    if (cat && types.has(cat.googleType)) {
      if (catId === "historic" || catId === "cave") {
        if (place.types.some((t) => FOOD_TYPES.has(t))) continue;
      }
      return catId;
    }
  }

  return inferCategory(place);
}

export function getCategorySearchTerm(catId: string): string | undefined {
  return CATEGORY_SEARCH_TERMS[catId] ?? POI_CATEGORIES.find((c) => c.id === catId)?.label;
}

function applyCategoryQuotas(
  ranked: PoiRecommendation[],
  selectedCategories: string[],
  maxCount: number
): PoiRecommendation[] {
  if (selectedCategories.length === 0) {
    return ranked.slice(0, maxCount);
  }

  const picked: PoiRecommendation[] = [];
  const pickedIds = new Set<string>();

  for (const catId of selectedCategories) {
    const best = ranked.find((rec) => rec.category === catId && !pickedIds.has(rec.placeId));
    if (best) {
      picked.push(best);
      pickedIds.add(best.placeId);
    }
  }

  for (const rec of ranked) {
    if (picked.length >= maxCount) break;
    if (!pickedIds.has(rec.placeId)) {
      picked.push(rec);
      pickedIds.add(rec.placeId);
    }
  }

  return picked.slice(0, maxCount);
}

export function rankPlaces(
  places: PlaceSearchResult[],
  wizard: TripWizardData,
  weather?: WeatherSummary,
  options?: {
    excludePlaceIds?: string[];
    corridor?: RouteCorridor;
    exploreMode?: boolean;
    searchCities?: RoutePoint[];
    pageSize?: number;
    allowedCityKeys?: string[];
  }
): PoiRecommendation[] {
  const maxCount =
    options?.pageSize ??
    (wizard.exploreMode ? getIntensityStopCount(wizard.exploreIntensity) : 3);

  const exclude = new Set(options?.excludePlaceIds ?? []);
  const corridor = options?.corridor;
  const exploreMode = options?.exploreMode ?? wizard.exploreMode;

  const allowedCityKeys = options?.allowedCityKeys ?? [];

  const recommendations: PoiRecommendation[] = places
    .filter((place) => !exclude.has(place.placeId))
    .filter((place) => addressMatchesCities(place.address, allowedCityKeys))
    .filter((place) => {
      if (allowedCityKeys.length > 0) return true;
      if (!corridor) return true;
      if (exploreMode) {
        return isAlongRoute(place.lat, place.lng, corridor, 80);
      }
      return isAlongRoute(place.lat, place.lng, corridor, 60);
    })
    .filter((place) => {
      if (!wizard.exploreMode || wizard.categories.length === 0) return true;
      const cat = classifyPlaceCategory(place, wizard.categories);
      return wizard.categories.includes(cat);
    })
    .map((place) => {
      const matchedCategory =
        wizard.exploreMode && wizard.categories.length > 0
          ? classifyPlaceCategory(place, wizard.categories)
          : wizard.categories.find((c) =>
              place.types.some((t) => POI_CATEGORIES.find((pc) => pc.id === c)?.googleType === t)
            ) ?? inferCategory(place);

      const review = place.reviews?.[0];
      const evidence = [
        {
          source: "google_places" as const,
          snippet: review?.text?.slice(0, 200) ?? `${place.rating ?? 4} puan, ${place.reviewCount ?? 0} yorum`,
          rating: place.rating,
          reviewCount: place.reviewCount,
        },
      ];

      const score = scorePlace(place, matchedCategory, wizard, weather);
      const routeBonus =
        corridor && exploreMode
          ? getProgressAlongRoute(place.lat, place.lng, corridor) * 8
          : 0;

      return {
        placeId: place.placeId,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        category: matchedCategory,
        rating: place.rating,
        reviewCount: place.reviewCount,
        photoUrl: place.photoUrl,
        photoUrls: place.photoUrls,
        googleMapsUrl: place.googleMapsUrl,
        websiteUrl: place.websiteUrl,
        durationMinutes: estimateDuration(matchedCategory, wizard),
        score: score + routeBonus,
        reason: "",
        evidence,
        weatherTag: getWeatherTagForPoi(matchedCategory, weather),
      };
    });

  let ranked = recommendations.sort((a, b) => b.score - a.score);

  if (options?.searchCities && options.searchCities.length > 1) {
    const perCity = Math.max(1, Math.ceil(maxCount / options.searchCities.length));
    const buckets: PoiRecommendation[][] = options.searchCities.map(() => []);

    for (const rec of ranked) {
      let nearestIdx = 0;
      let minDist = Number.POSITIVE_INFINITY;
      options.searchCities.forEach((city, idx) => {
        const dist = haversineKm(rec, city);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = idx;
        }
      });
      buckets[nearestIdx].push(rec);
    }

    ranked = buckets.flatMap((bucket) => bucket.sort((a, b) => b.score - a.score).slice(0, perCity));
    ranked.sort((a, b) => b.score - a.score);
  }

  if (wizard.exploreMode && wizard.categories.length > 0) {
    ranked = applyCategoryQuotas(ranked, wizard.categories, maxCount);
  } else {
    ranked = ranked.slice(0, maxCount);
  }

  return ranked;
}

/**
 * Tek bir (kategori, şehir) grubu için sıralı öneri listesi üretir.
 * - category "general" ise kategori filtresi uygulanmaz.
 * - allowedCityKeys ile adres bazlı şehir filtresi uygulanır.
 */
export function buildCategoryGroup(
  places: PlaceSearchResult[],
  category: string,
  wizard: TripWizardData,
  weather: WeatherSummary | undefined,
  options: {
    excludePlaceIds?: string[];
    allowedCityKeys?: string[];
    limit?: number;
    cityName?: string;
  }
): PoiRecommendation[] {
  const exclude = new Set(options.excludePlaceIds ?? []);
  const allowedCityKeys = options.allowedCityKeys ?? [];
  const limit = options.limit ?? 3;
  const isGeneral = category === "general";

  return places
    .filter((place) => !exclude.has(place.placeId))
    .filter((place) => addressMatchesCities(place.address, allowedCityKeys))
    .filter((place) => {
      if (isGeneral) return true;
      return classifyPlaceCategory(place, [category]) === category;
    })
    .map((place) => {
      const cat = isGeneral ? inferCategory(place) : category;
      const review = place.reviews?.[0];
      const score = scorePlace(place, cat, wizard, weather);

      return {
        placeId: place.placeId,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        category: cat,
        rating: place.rating,
        reviewCount: place.reviewCount,
        photoUrl: place.photoUrl,
        photoUrls: place.photoUrls,
        googleMapsUrl: place.googleMapsUrl,
        websiteUrl: place.websiteUrl,
        durationMinutes: estimateDuration(cat, wizard),
        score,
        reason: "",
        evidence: [
          {
            source: "google_places" as const,
            snippet:
              review?.text?.slice(0, 200) ??
              `${place.rating ?? 4} puan, ${place.reviewCount ?? 0} yorum`,
            rating: place.rating,
            reviewCount: place.reviewCount,
          },
        ],
        weatherTag: getWeatherTagForPoi(cat, weather, options.cityName),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function inferCategory(place: PlaceSearchResult): string {
  if (place.types.includes("museum")) return "museum";
  if (place.types.includes("restaurant")) return "food";
  if (place.types.includes("park")) return "nature";
  if (place.types.includes("lodging")) return "lodging";
  return "historic";
}

function estimateDuration(category: string, wizard: TripWizardData): number {
  const base: Record<string, number> = {
    museum: 90,
    cave: 60,
    nature: 120,
    beach: 180,
    historic: 75,
    food: 60,
    shopping: 90,
    thermal: 120,
  };

  let duration = base[category] ?? 60;
  if (wizard.pace === "RELAXED") duration += 30;
  if (wizard.pace === "PACKED") duration -= 15;
  if (wizard.childrenAges.length > 0) duration += 15;
  return duration;
}

export function filterLodging(
  places: PlaceSearchResult[],
  wizard: TripWizardData,
  options?: {
    excludePlaceIds?: string[];
    corridor?: RouteCorridor;
    allowedCityKeys?: string[];
  }
): PoiRecommendation[] {
  const exclude = new Set(options?.excludePlaceIds ?? []);
  const corridor = options?.corridor;
  const allowedCityKeys = options?.allowedCityKeys ?? [];
  const amenities = wizard.lodgingAmenities ?? [];
  const wantsBreakfast = amenities.includes("BREAKFAST") || wizard.lodgingBreakfast;

  return places
    .filter((place) => !exclude.has(place.placeId))
    .filter((place) => addressMatchesCities(place.address, allowedCityKeys))
    .filter((place) => {
      if (allowedCityKeys.length > 0) return true;
      return corridor ? isAlongRoute(place.lat, place.lng, corridor, 80) : true;
    })
    .map((place) => {
      const reviewText = place.reviews?.[0]?.text?.toLowerCase() ?? "";
      const hasBreakfastHint = wantsBreakfast && reviewText.includes("kahvalt");

      let score = scorePlace(place, "lodging", wizard);
      if (hasBreakfastHint) score += 15;

      for (const amenity of amenities) {
        const keywords = LODGING_AMENITY_KEYWORDS[amenity] ?? [];
        if (keywords.some((keyword) => reviewText.includes(keyword))) {
          score += 12;
        }
      }

      if (amenities.includes("FAMILY") && (wizard.childrenAges.length > 0 || wizard.hasBaby)) {
        score += 8;
      }

      if (wizard.lodgingPriceRange === "LOW" && (place.priceLevel ?? 2) <= 2) score += 10;
      if (wizard.lodgingPriceRange === "HIGH" && (place.priceLevel ?? 2) >= 3) score += 10;

      const review = place.reviews?.[0];

      return {
        placeId: place.placeId,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        category: "lodging",
        rating: place.rating,
        reviewCount: place.reviewCount,
        photoUrl: place.photoUrl,
        photoUrls: place.photoUrls,
        googleMapsUrl: place.googleMapsUrl,
        websiteUrl: place.websiteUrl,
        durationMinutes: 0,
        score,
        reason: "",
        evidence: [
          {
            source: "google_places" as const,
            snippet:
              review?.text?.slice(0, 200) ??
              `${place.rating ?? 4} puanlı konaklama`,
            rating: place.rating,
            reviewCount: place.reviewCount,
          },
        ],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
