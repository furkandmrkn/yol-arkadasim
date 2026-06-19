import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTripForModify } from "@/lib/trip-auth";
import { searchPlacesNearby, type PlaceSearchResult } from "@/lib/google/maps";
import { buildCategoryGroup, buildGroupSearchQueries, buildCityMatchKeys, normalizeTransport } from "@/lib/scoring";
import { generateRecommendationReasons } from "@/lib/llm";
import { getWeatherForecast } from "@/lib/weather";
import {
  getRecommendationMaxPages,
  getRecommendationPerGroupLimit,
  resolveRecommendationCategories,
} from "@/lib/utils";
import { getProgressAlongRoute } from "@/lib/route-utils";
import { getLocationById } from "@/data/turkish-locations";
import type { TripWizardData, WeatherSummary, PoiRecommendation } from "@/types/trip";

// Vercel Pro: en fazla 60 sn. Hobby planda üst sınır ~10 sn kalır.
export const maxDuration = 60;

interface ResolvedCity {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

function buildWizard(trip: NonNullable<Awaited<ReturnType<typeof prisma.trip.findUnique>>>): TripWizardData {
  return {
    planType: trip.planType ?? "TRIP",
    origin: trip.origin,
    destination: trip.destination,
    startDate: trip.startDate.toISOString().split("T")[0],
    endDate: trip.endDate.toISOString().split("T")[0],
    days: trip.days,
    adults: trip.adults,
    childrenAges: trip.childrenAges,
    hasBaby: trip.hasBaby,
    transport: normalizeTransport(trip.transport),
    budget: trip.budget,
    pace: trip.pace,
    foodPreferences: trip.foodPreferences,
    exploreMode: trip.exploreMode,
    exploreIntensity: trip.exploreIntensity ?? undefined,
    categories: trip.categories,
    localVsTourist: trip.localVsTourist,
    recommendationScope: "DESTINATION_ONLY",
    selectedRouteCities: [],
    lodgingNeeded: trip.lodgingNeeded,
    lodgingBreakfast: trip.lodgingBreakfast,
    lodgingAmenities: [],
    lodgingScope: "DESTINATION_ONLY",
    selectedLodgingCities: [],
    lodgingType: trip.lodgingType ?? undefined,
    lodgingPriceRange: trip.lodgingPriceRange ?? undefined,
  };
}

async function fetchGroup(
  city: ResolvedCity,
  category: string,
  wizard: TripWizardData,
  weather: WeatherSummary | undefined,
  excludePlaceIds: string[],
  limit: number,
  variant: number,
  options?: { skipReasons?: boolean }
): Promise<PoiRecommendation[]> {
  const isTransit = normalizeTransport(wizard.transport) === "TRANSIT";
  const radius = isTransit ? 25000 : 40000;
  const queries = buildGroupSearchQueries(city.label, category, wizard, variant);

  const nested = await Promise.all(
    queries.map((q) => searchPlacesNearby(city.lat, city.lng, q, radius))
  );

  const dedup = new Map<string, PlaceSearchResult>();
  for (const arr of nested) {
    for (const place of arr) {
      if (!dedup.has(place.placeId)) dedup.set(place.placeId, place);
    }
  }

  const allowedCityKeys = buildCityMatchKeys([city.label]);
  let items = buildCategoryGroup(Array.from(dedup.values()), category, wizard, weather, {
    excludePlaceIds,
    allowedCityKeys,
    limit,
    cityName: city.label,
    cityCenter: { lat: city.lat, lng: city.lng },
  });

  if (!options?.skipReasons && items.length > 0) {
    items = await generateRecommendationReasons(items, wizard);
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tripId,
      mode = "grouped",
      categories = [],
      cities = [],
      category,
      cityId,
      excludePlaceIds = [],
      limit = 3,
      variant = 0,
    } = body;

    if (!tripId) {
      return NextResponse.json({ error: "tripId gerekli" }, { status: 400 });
    }

    const access = await getTripForModify(tripId);
    if (!access.ok) return access.response;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    const wizard = buildWizard(trip);
    const perGroupLimit = getRecommendationPerGroupLimit(wizard, limit);
    const maxPages = getRecommendationMaxPages(wizard);
    const destLat = trip.destLat ?? 39.0;
    const destLng = trip.destLng ?? 35.0;
    const corridor = {
      originLat: trip.originLat ?? destLat,
      originLng: trip.originLng ?? destLng,
      destLat,
      destLng,
    };

    const resolveCity = (id: string): ResolvedCity => {
      const loc = getLocationById(id);
      if (loc) return { id: loc.id, label: loc.label, lat: loc.lat, lng: loc.lng };
      return { id: id || "destination", label: trip.destination, lat: destLat, lng: destLng };
    };

    // Her şehir kendi gününün hava durumuna göre değerlendirilir (varsayılan: 1. gün).
    const cityDayWeather = async (city: ResolvedCity): Promise<WeatherSummary | undefined> => {
      const forecast = await getWeatherForecast(city.lat, city.lng, city.label, wizard.startDate, 1);
      return forecast[0];
    };

    if (mode === "group") {
      const cat = (category as string) || (trip.categories[0] ?? "general");
      const resolvedCity = resolveCity(cityId as string);
      const dayWeather = await cityDayWeather(resolvedCity);
      const items = await fetchGroup(
        resolvedCity,
        cat,
        wizard,
        dayWeather,
        excludePlaceIds,
        perGroupLimit,
        variant
      );
      return NextResponse.json({ items, maxPages, perGroupLimit });
    }

    // mode === "grouped"
    const categoryList: string[] =
      (categories as string[]).length > 0
        ? (categories as string[])
        : resolveRecommendationCategories(wizard);

    const cityList: ResolvedCity[] = (
      (cities as string[]).length > 0
        ? (cities as string[]).map(resolveCity)
        : [{ id: "destination", label: trip.destination, lat: destLat, lng: destLng }]
    ).sort(
      (a, b) =>
        getProgressAlongRoute(a.lat, a.lng, corridor) -
        getProgressAlongRoute(b.lat, b.lng, corridor)
    );

    // Plan sayfası için varış noktası hava durumu saklanır.
    const weather = await getWeatherForecast(
      destLat,
      destLng,
      trip.destination,
      wizard.startDate,
      trip.days
    );
    await prisma.trip.update({
      where: { id: tripId },
      data: { weatherSummary: weather as object[] },
    });

    const cityWeatherMap = new Map<string, WeatherSummary | undefined>();
    await Promise.all(
      cityList.map(async (city) => {
        cityWeatherMap.set(city.id, await cityDayWeather(city));
      })
    );

    const combos = categoryList.flatMap((cat) => cityList.map((city) => ({ cat, city })));
    const settled = await Promise.allSettled(
      combos.map(async ({ cat, city }) => ({
        category: cat,
        cityId: city.id,
        cityLabel: city.label,
        items: await fetchGroup(
          city,
          cat,
          wizard,
          cityWeatherMap.get(city.id),
          [],
          perGroupLimit,
          variant,
          { skipReasons: true }
        ),
      }))
    );

    const groups: {
      category: string;
      cityId: string;
      cityLabel: string;
      items: PoiRecommendation[];
    }[] = [];

    for (const result of settled) {
      if (result.status === "fulfilled") {
        groups.push(result.value);
      } else {
        console.warn("Grup atlandı:", result.reason);
      }
    }

    // Tek OpenAI çağrısı — Vercel timeout riskini azaltır.
    const allItems = groups.flatMap((g) => g.items);
    if (allItems.length > 0) {
      const withReasons = await generateRecommendationReasons(allItems, wizard);
      const reasonMap = new Map(withReasons.map((r) => [r.placeId, r.reason]));
      for (const group of groups) {
        group.items = group.items.map((item) => ({
          ...item,
          reason: reasonMap.get(item.placeId) ?? item.reason,
        }));
      }
    }

    return NextResponse.json({ groups, weather, maxPages, perGroupLimit });
  } catch (error) {
    console.error("POST /api/recommendations error:", error);
    return NextResponse.json({ error: "Öneriler alınamadı" }, { status: 500 });
  }
}
