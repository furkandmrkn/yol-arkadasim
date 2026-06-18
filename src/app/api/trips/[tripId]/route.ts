import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildGoogleMapsPlaceUrl } from "@/lib/google/maps";
import { z } from "zod";
import type { RecommendationEvidence, TripWizardData } from "@/types/trip";

function parseStopEvidence(raw: unknown): {
  evidence: RecommendationEvidence[];
  photoUrls?: string[];
  googleMapsUrl?: string;
  websiteUrl?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { evidence: [] };
  }

  if (Array.isArray(raw)) {
    return { evidence: raw as RecommendationEvidence[] };
  }

  const wrapped = raw as {
    items?: RecommendationEvidence[];
    photoUrls?: string[];
    googleMapsUrl?: string;
    websiteUrl?: string;
  };

  return {
    evidence: wrapped.items ?? [],
    photoUrls: wrapped.photoUrls,
    googleMapsUrl: wrapped.googleMapsUrl,
    websiteUrl: wrapped.websiteUrl,
  };
}

const updateSchema = z.object({
  lodgingBreakfast: z.boolean().optional(),
  lodgingType: z.enum(["HOTEL", "PENSION", "APART", "ANY"]).optional(),
  lodgingPriceRange: z.enum(["LOW", "MID", "HIGH"]).optional(),
  lodgingNeeded: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.tripId },
      include: { stops: { orderBy: { sortOrder: "asc" } } },
    });

    if (!trip) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

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
      lodgingBreakfast: trip.lodgingBreakfast,
      lodgingAmenities: [],
      lodgingScope: "DESTINATION_ONLY",
      selectedLodgingCities: [],
      lodgingType: trip.lodgingType ?? undefined,
      lodgingPriceRange: trip.lodgingPriceRange ?? undefined,
    };

    const stops = trip.stops.map((s) => {
      const parsedEvidence = parseStopEvidence(s.evidence);
      const placeId = s.placeId ?? s.id;

      return {
        placeId,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        address: s.address ?? undefined,
        category: s.category ?? "historic",
        rating: s.rating ?? undefined,
        reviewCount: s.reviewCount ?? undefined,
        photoUrl: s.photoUrl ?? undefined,
        photoUrls: parsedEvidence.photoUrls ?? (s.photoUrl ? [s.photoUrl] : undefined),
        googleMapsUrl:
          parsedEvidence.googleMapsUrl ??
          (placeId ? buildGoogleMapsPlaceUrl(placeId, s.name) : undefined),
        websiteUrl: parsedEvidence.websiteUrl,
        durationMinutes: s.durationMinutes,
        score: 0,
        reason: s.reason ?? "",
        evidence: parsedEvidence.evidence,
        weatherTag: s.weatherTag ?? undefined,
        stopType: s.stopType,
        day: s.day,
        sortOrder: s.sortOrder,
      };
    });

    return NextResponse.json({
      id: trip.id,
      status: trip.status,
      wizard,
      stops,
      route: trip.routeSummary,
      weather: trip.weatherSummary,
      origin: { lat: trip.originLat, lng: trip.originLng, label: trip.origin },
      destination: { lat: trip.destLat, lng: trip.destLng, label: trip.destination },
    });
  } catch (error) {
    console.error("GET /api/trips/[tripId] error:", error);
    return NextResponse.json({ error: "Plan alınamadı" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }

    const trip = await prisma.trip.update({
      where: { id: params.tripId },
      data: parsed.data,
    });

    return NextResponse.json({ trip });
  } catch (error) {
    console.error("PATCH /api/trips/[tripId] error:", error);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}
