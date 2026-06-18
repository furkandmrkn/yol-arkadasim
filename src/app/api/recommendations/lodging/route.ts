import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchLodgingAtPoints } from "@/lib/google/maps";
import { filterLodging, buildCityMatchKeys } from "@/lib/scoring";
import { generateRecommendationReasons } from "@/lib/llm";
import { findCitiesAlongRoute, resolveCityLocations } from "@/lib/route-utils";
import type { TripWizardData } from "@/types/trip";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tripId,
      excludePlaceIds = [],
      queryVariant = 0,
      lodgingAmenities = [],
      lodgingScope = "DESTINATION_ONLY",
      selectedLodgingCities = [],
      lodgingPlacement,
    } = body;

    if (!tripId) {
      return NextResponse.json({ error: "tripId gerekli" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    const resolvedScope =
      lodgingScope ??
      (lodgingPlacement === "MID_ROUTE" ? "SELECTED_CITIES" : "DESTINATION_ONLY");

    const wizard: TripWizardData = {
      origin: trip.origin,
      destination: trip.destination,
      startDate: trip.startDate.toISOString().split("T")[0],
      endDate: trip.endDate.toISOString().split("T")[0],
      days: trip.days,
      adults: trip.adults,
      childrenAges: trip.childrenAges,
      hasBaby: trip.hasBaby,
      transport: trip.transport,
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
      lodgingBreakfast: lodgingAmenities.includes("BREAKFAST") || trip.lodgingBreakfast,
      lodgingAmenities,
      lodgingScope: resolvedScope,
      selectedLodgingCities,
      lodgingType: trip.lodgingType ?? undefined,
      lodgingPriceRange: trip.lodgingPriceRange ?? undefined,
    };

    const originLat = trip.originLat ?? 39.0;
    const originLng = trip.originLng ?? 35.0;
    const destLat = trip.destLat ?? 39.0;
    const destLng = trip.destLng ?? 35.0;
    const corridor = { originLat, originLng, destLat, destLng };

    let searchLocations =
      resolvedScope === "SELECTED_CITIES" && selectedLodgingCities.length > 0
        ? resolveCityLocations(selectedLodgingCities)
        : [];

    if (searchLocations.length === 0) {
      searchLocations = [
        {
          id: "destination",
          label: trip.destination,
          lat: destLat,
          lng: destLng,
        },
      ];
    }

    const searchPoints = searchLocations.map((city) => ({
      lat: city.lat,
      lng: city.lng,
      cityLabel: city.label,
    }));

    const amenities = {
      pool: lodgingAmenities.includes("POOL"),
      family: lodgingAmenities.includes("FAMILY"),
      parking: lodgingAmenities.includes("PARKING"),
    };

    const places = await searchLodgingAtPoints(searchPoints, trip.lodgingType ?? undefined, {
      queryVariant,
      amenities,
    });
    let lodging = filterLodging(places, wizard, {
      excludePlaceIds,
      corridor,
      allowedCityKeys: buildCityMatchKeys(searchLocations.map((city) => city.label)),
    });
    lodging = await generateRecommendationReasons(lodging, wizard);

    const routeCities = findCitiesAlongRoute(originLat, originLng, destLat, destLng).map(
      (c) => c.label
    );

    return NextResponse.json({
      lodging,
      lodgingSearchCity: searchLocations.map((c) => c.label).join(", "),
      lodgingSearchCities: searchLocations.map((c) => c.label),
      lodgingScope: resolvedScope,
      routeCities,
    });
  } catch (error) {
    console.error("POST /api/recommendations/lodging error:", error);
    return NextResponse.json({ error: "Konaklama önerileri alınamadı" }, { status: 500 });
  }
}
