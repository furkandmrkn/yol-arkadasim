import type { TripWizardData, PoiRecommendation, WeatherSummary } from "@/types/trip";
import type { PlaceSearchResult } from "@/lib/google/maps";
import { POI_CATEGORIES } from "@/types/trip";
import {
  compareRecommendationRank,
  computePopularityScore,
  scoreLocalVsTouristFit,
} from "@/lib/scoring/popularity";
import { getIntensityStopCount, getPaceRecommendationConfig } from "@/lib/utils";
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

/** Toplu taşımayla genelde ulaşılamayan kırsal/doğa kategorileri */
const TRANSIT_REMOTE_CATEGORIES = new Set(["nature", "beach", "cave"]);

const CAR_CATEGORY_QUERIES: Record<string, string[]> = {
  nature: ["tabiat parkı", "mesire alanı", "göl manzara"],
  food: ["restoran", "yerel yemek"],
  museum: ["müze", "arkeoloji müzesi"],
  historic: ["tarihi yer", "kale antik"],
  beach: ["plaj", "sahil"],
  cave: ["mağara", "underground city"],
  shopping: ["alışveriş merkezi", "çarşı"],
  thermal: ["termal kaplıca"],
};

const TRANSIT_CATEGORY_QUERIES: Record<string, string[]> = {
  nature: ["şehir parkı", "kent parkı", "botanik bahçe"],
  food: ["merkez restoran", "lokanta"],
  museum: ["müze", "müzesi"],
  historic: ["tarihi merkez", "kale"],
  beach: ["sahil", "plaj"],
  shopping: ["alışveriş merkezi", "çarşı"],
  thermal: ["spa termal merkez"],
};

export interface CityCenter {
  lat: number;
  lng: number;
}

export function normalizeTransport(transport: string): TripWizardData["transport"] {
  return transport === "TRANSIT" ? "TRANSIT" : "CAR";
}

function foldedPlaceText(place: PlaceSearchResult): string {
  const review = place.reviews?.[0]?.text ?? "";
  return foldTr(`${place.name} ${place.address ?? ""} ${review}`);
}

/** Toplu taşımayla makul ulaşılabilirlik — şehir merkezine uzak kırsal noktalar elenir. */
export function isAccessibleByTransit(
  place: PlaceSearchResult,
  category: string,
  cityCenter: CityCenter | undefined
): boolean {
  if (!cityCenter) return true;

  const distKm = haversineKm(
    { lat: place.lat, lng: place.lng },
    { lat: cityCenter.lat, lng: cityCenter.lng }
  );

  if (place.types.includes("natural_feature") && distKm > 5) return false;
  if (TRANSIT_REMOTE_CATEGORIES.has(category) && distKm > 7) return false;
  if (distKm > 14) return false;

  return true;
}

function scoreFoodPreferences(place: PlaceSearchResult, prefs: string[]): number {
  if (prefs.length === 0) return 0;

  const text = foldedPlaceText(place);
  let delta = 0;

  const servesAlcohol = place.types.includes("bar") || place.types.includes("night_club");

  if (prefs.includes("İçkili (alkollü) mekan")) {
    delta += servesAlcohol ? 12 : -4;
  }
  if (prefs.includes("İçkisiz (alkolsüz) mekan")) {
    delta += servesAlcohol ? -12 : 6;
  }
  if (prefs.includes("Yerel mutfak")) {
    if (/yerel|local|geleneksel|otantik|ev yemek/.test(text)) delta += 10;
  }
  if (prefs.includes("Vejetaryen")) {
    if (/vejetaryen|vegetarian/.test(text)) delta += 14;
    if (/vegan/.test(text)) delta += 10;
  }
  if (prefs.includes("Vegan")) {
    if (/vegan/.test(text)) delta += 16;
    if (/et lok|kebap|steakhouse|ocakba/.test(text) && !/vegan|vejetaryen/.test(text)) delta -= 10;
  }
  if (prefs.includes("Helal")) {
    if (/helal|halal/.test(text)) delta += 14;
  }
  if (prefs.includes("Glutensiz")) {
    if (/glutensiz|gluten free|gluten-free|çölyak/.test(text)) delta += 14;
  }
  if (prefs.includes("Deniz ürünleri")) {
    if (/balık|balik|seafood|deniz ürün|ahtapot|karides|midye/.test(text)) delta += 14;
    if (place.types.includes("restaurant") && /balık|balik|fish/.test(foldTr(place.name))) delta += 8;
  }

  return delta;
}

function scoreTransportFit(
  place: PlaceSearchResult,
  category: string,
  wizard: TripWizardData,
  cityCenter: CityCenter | undefined
): number {
  if (wizard.transport !== "TRANSIT") {
    if (["nature", "beach", "cave"].includes(category)) return 8;
    return 0;
  }

  if (!cityCenter) return 0;

  const distKm = haversineKm(
    { lat: place.lat, lng: place.lng },
    { lat: cityCenter.lat, lng: cityCenter.lng }
  );
  let delta = 0;

  if (distKm <= 3) delta += 12;
  else if (distKm <= 6) delta += 6;
  else if (distKm <= 10) delta -= 5;
  else delta -= 20;

  if (["museum", "historic", "food", "shopping"].includes(category) && distKm <= 8) delta += 8;
  if (TRANSIT_REMOTE_CATEGORIES.has(category)) delta -= 15;
  if (place.types.includes("natural_feature")) delta -= 12;

  return delta;
}

function appendBudgetSearchQueries(
  queries: Set<string>,
  cityLabel: string,
  category: string,
  budget: TripWizardData["budget"]
): void {
  if (category !== "food" && category !== "general") return;
  if (budget === "BUDGET") {
    queries.add(`${cityLabel} uygun fiyat restoran`);
    queries.add(`${cityLabel} ekonomik yemek`);
  }
  if (budget === "LUXURY") {
    queries.add(`${cityLabel} fine dining lüks restoran`);
    queries.add(`${cityLabel} özel restoran`);
  }
}

function scoreBudgetFit(place: PlaceSearchResult, wizard: TripWizardData, category: string): number {
  const pl = place.priceLevel;
  if (pl == null) return 0;

  let delta = 0;
  if (wizard.budget === "BUDGET") {
    if (pl <= 1) delta += 14;
    else if (pl === 2) delta += 5;
    else if (pl >= 3) delta -= 18;
  } else if (wizard.budget === "LUXURY") {
    if (pl >= 4) delta += 14;
    else if (pl === 3) delta += 8;
    else if (pl <= 1) delta -= 12;
  } else {
    if (pl === 2) delta += 8;
    else if (pl === 1 || pl === 3) delta += 3;
  }

  if (category === "food") {
    delta = Math.round(delta * 1.2);
  }

  return delta;
}

/** Gezerek git kapalıyken tempo, öneri çeşitliliğini ve kalite beklentisini yansıtır. */
function scorePaceDestinationFit(place: PlaceSearchResult, wizard: TripWizardData): number {
  if (wizard.exploreMode) return 0;

  const reviews = place.reviewCount ?? 0;
  const rating = place.rating ?? 0;

  if (wizard.pace === "RELAXED") {
    if (reviews > 15000) return -10;
    if (reviews < 4000) return 6;
    return 3;
  }
  if (wizard.pace === "PACKED") {
    if (rating >= 4.6) return 12;
    if (rating >= 4.3) return 6;
    if (reviews > 5000) return 5;
    return -4;
  }
  return 0;
}

function appendFoodSearchQueries(queries: Set<string>, cityLabel: string, prefs: string[]): void {
  if (prefs.includes("Yerel mutfak")) queries.add(`${cityLabel} yerel yemek restoran`);
  if (prefs.includes("İçkili (alkollü) mekan")) queries.add(`${cityLabel} meyhane restoran`);
  if (prefs.includes("İçkisiz (alkolsüz) mekan")) queries.add(`${cityLabel} aile restoranı`);
  if (prefs.includes("Vejetaryen")) queries.add(`${cityLabel} vejetaryen restoran`);
  if (prefs.includes("Vegan")) queries.add(`${cityLabel} vegan restoran`);
  if (prefs.includes("Helal")) queries.add(`${cityLabel} helal restoran`);
  if (prefs.includes("Glutensiz")) queries.add(`${cityLabel} glutensiz restoran`);
  if (prefs.includes("Deniz ürünleri")) queries.add(`${cityLabel} balık restoran`);
}

/** Grup bazlı Google arama sorguları — ulaşım modu ve yemek tercihlerine göre. */
export function buildGroupSearchQueries(
  cityLabel: string,
  category: string,
  wizard: TripWizardData,
  variant: number
): string[] {
  const transport = normalizeTransport(wizard.transport);
  const term =
    category === "general" ? "gezilecek yerler popüler" : getCategorySearchTerm(category) ?? category;
  const queries = new Set<string>();

  if (transport === "TRANSIT") {
    queries.add(`${cityLabel} merkez ${term}`);
  } else {
    queries.add(`${cityLabel} ${term}`);
  }

  const extras =
    transport === "TRANSIT"
      ? (TRANSIT_CATEGORY_QUERIES[category] ?? [])
      : (CAR_CATEGORY_QUERIES[category] ?? []);

  for (const extra of extras) {
    queries.add(`${cityLabel} ${extra}`);
  }

  if (category === "food") {
    appendFoodSearchQueries(queries, cityLabel, wizard.foodPreferences);
  }

  appendBudgetSearchQueries(queries, cityLabel, category, wizard.budget);

  if (wizard.localVsTourist >= 67) {
    if (category === "food") {
      queries.add(`${cityLabel} meşhur turistik restoran`);
      queries.add(`${cityLabel} en popüler restoran`);
    } else if (["general", "historic", "museum"].includes(category)) {
      queries.add(`${cityLabel} turistik popüler ${term}`);
    }
  } else if (wizard.localVsTourist <= 33) {
    if (category === "food") {
      queries.add(`${cityLabel} yerel sakin restoran`);
    } else if (category === "general") {
      queries.add(`${cityLabel} az bilinen gezilecek yer`);
    }
  }

  if (variant > 0) {
    queries.add(`${cityLabel} ${term} popüler`);
    queries.add(`${cityLabel} en iyi ${term}`);
  }

  return Array.from(queries).slice(0, 6);
}

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
  weather?: WeatherSummary,
  cityCenter?: CityCenter
): number {
  let score = 20;

  score += computePopularityScore(place.rating, place.reviewCount);
  score += scoreLocalVsTouristFit(place.reviewCount, wizard.localVsTourist);

  if (wizard.childrenAges.length > 0 || wizard.hasBaby) {
    if (["museum", "nature", "beach"].includes(category)) score += 10;
    if (category === "cave") score += 5;
  }

  score += scoreBudgetFit(place, wizard, category);

  if (weather?.isRainy) {
    if (INDOOR_CATEGORIES.has(category)) score += 20;
    if (OUTDOOR_CATEGORIES.has(category)) score -= 25;
  }

  if (weather?.isHot) {
    if (["cave", "museum", "thermal"].includes(category)) score += 15;
    if (category === "beach") score += 10;
  }

  if (wizard.pace === "RELAXED" && wizard.localVsTourist < 50) {
    score += (place.reviewCount ?? 0) > 8000 ? -5 : 3;
  }
  if (wizard.pace === "PACKED" && (place.rating ?? 0) >= 4.5) score += 5;
  score += scorePaceDestinationFit(place, wizard);

  if (category === "food") {
    score += scoreFoodPreferences(place, wizard.foodPreferences);
  }

  score += scoreTransportFit(place, category, wizard, cityCenter);

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
  const transport = normalizeTransport(wizard.transport);

  if (wizard.exploreMode && wizard.categories.length > 0) {
    for (const city of cities) {
      for (const catId of wizard.categories) {
        const built = buildGroupSearchQueries(city, catId, wizard, variant);
        queries.push(...built);
      }
    }
    if (variant > 0) {
      for (const city of cities.slice(0, 2)) {
        queries.push(
          transport === "TRANSIT" ? `${city} merkez gezilecek yerler` : `${city} gezilecek yerler`
        );
      }
    }
  } else {
    const cats = wizard.exploreMode
      ? (["general"] as const)
      : getPaceRecommendationConfig(wizard.pace).categories;

    for (const city of cities) {
      for (const catId of cats) {
        queries.push(...buildGroupSearchQueries(city, catId, wizard, variant));
      }
    }
  }

  const foodCity = cities[Math.floor(cities.length / 2)] ?? dest;
  const foodQueries = new Set<string>();
  appendFoodSearchQueries(foodQueries, foodCity, wizard.foodPreferences);
  queries.push(...Array.from(foodQueries));

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

  let ranked = recommendations.sort(compareRecommendationRank);

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

    ranked = buckets.flatMap((bucket) => bucket.sort(compareRecommendationRank).slice(0, perCity));
    ranked.sort(compareRecommendationRank);
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
    cityCenter?: CityCenter;
  }
): PoiRecommendation[] {
  const exclude = new Set(options.excludePlaceIds ?? []);
  const allowedCityKeys = options.allowedCityKeys ?? [];
  const limit = options.limit ?? 3;
  const isGeneral = category === "general";
  const cityCenter = options.cityCenter;
  const isTransit = normalizeTransport(wizard.transport) === "TRANSIT";

  return places
    .filter((place) => !exclude.has(place.placeId))
    .filter((place) => addressMatchesCities(place.address, allowedCityKeys))
    .filter((place) => {
      if (isGeneral) return true;
      return classifyPlaceCategory(place, [category]) === category;
    })
    .filter((place) => {
      if (!isTransit) return true;
      return isAccessibleByTransit(place, category, cityCenter);
    })
    .map((place) => {
      const cat = isGeneral ? inferCategory(place) : category;
      const review = place.reviews?.[0];
      const score = scorePlace(place, cat, wizard, weather, cityCenter);

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
    .sort(compareRecommendationRank)
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
    .sort(compareRecommendationRank)
    .slice(0, 5);
}
