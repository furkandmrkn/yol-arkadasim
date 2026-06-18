import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tripWizardSchema } from "@/types/trip";
import { geocodeAddress } from "@/lib/google/maps";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = tripWizardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const [originGeo, destGeo] = await Promise.all([
      geocodeAddress(data.origin),
      geocodeAddress(data.destination),
    ]);

    const trip = await prisma.trip.create({
      data: {
        origin: data.origin,
        destination: data.destination,
        originLat: originGeo?.lat,
        originLng: originGeo?.lng,
        destLat: destGeo?.lat,
        destLng: destGeo?.lng,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days: data.days,
        adults: data.adults,
        childrenAges: data.childrenAges,
        hasBaby: data.hasBaby,
        transport: data.transport,
        budget: data.budget,
        pace: data.pace,
        foodPreferences: data.foodPreferences,
        exploreMode: data.exploreMode,
        exploreIntensity: data.exploreIntensity,
        categories: data.categories,
        localVsTourist: data.localVsTourist,
        lodgingNeeded: data.lodgingNeeded,
        lodgingBreakfast: data.lodgingBreakfast,
        lodgingType: data.lodgingType,
        lodgingPriceRange: data.lodgingPriceRange,
      },
    });

    return NextResponse.json({ id: trip.id, trip });
  } catch (error) {
    console.error("POST /api/trips error:", error);
    return NextResponse.json({ error: "Trip oluşturulamadı" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        origin: true,
        destination: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ trips });
  } catch (error) {
    console.error("GET /api/trips error:", error);
    return NextResponse.json({ error: "Trips alınamadı" }, { status: 500 });
  }
}
