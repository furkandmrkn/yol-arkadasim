import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getProgressAlongRoute,
  sortByRouteProgress,
  type RouteCorridor,
} from "@/lib/route-utils";

const stopSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  photoUrl: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  googleMapsUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
  durationMinutes: z.number().default(60),
  reason: z.string().optional(),
  evidence: z.array(z.unknown()).optional(),
  weatherTag: z.string().optional(),
  sortOrder: z.number().default(0),
});

const bodySchema = z.object({
  stops: z.array(stopSchema),
  lodging: stopSchema.optional(),
});

function assignDayByProgress(
  progress: number,
  days: number,
  lodgingProgress?: number
): number {
  if (days <= 1) return 1;

  if (lodgingProgress !== undefined && lodgingProgress < 0.8) {
    return progress <= lodgingProgress ? 1 : days;
  }

  if (progress < 0.34) return 1;
  if (progress < 0.67) return Math.min(2, days);
  return days;
}

export async function PUT(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: params.tripId } });
    if (!trip) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    const corridor: RouteCorridor = {
      originLat: trip.originLat ?? 39,
      originLng: trip.originLng ?? 35,
      destLat: trip.destLat ?? 39,
      destLng: trip.destLng ?? 35,
    };

    const sortedStops = sortByRouteProgress(parsed.data.stops, corridor);
    const lodgingProgress = parsed.data.lodging
      ? getProgressAlongRoute(parsed.data.lodging.lat, parsed.data.lodging.lng, corridor)
      : undefined;

    await prisma.tripStop.deleteMany({ where: { tripId: params.tripId } });

    const stopRecords: Prisma.TripStopCreateManyInput[] = sortedStops.map((stop, index) => {
      const progress = getProgressAlongRoute(stop.lat, stop.lng, corridor);
      return {
        tripId: params.tripId,
        placeId: stop.placeId,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        address: stop.address,
        category: stop.category,
        stopType: "POI",
        day: assignDayByProgress(progress, trip.days, lodgingProgress),
        sortOrder: index,
        durationMinutes: stop.durationMinutes,
        rating: stop.rating,
        reviewCount: stop.reviewCount,
        photoUrl: stop.photoUrl,
        reason: stop.reason,
        evidence: {
          items: stop.evidence,
          photoUrls: stop.photoUrls,
          googleMapsUrl: stop.googleMapsUrl,
          websiteUrl: stop.websiteUrl,
        } as Prisma.InputJsonValue | undefined,
        weatherTag: stop.weatherTag,
        selected: true,
      };
    });

    if (parsed.data.lodging) {
      const l = parsed.data.lodging;
      const lp = getProgressAlongRoute(l.lat, l.lng, corridor);
      const lodgingDay =
        trip.days > 1 && lp < 0.8 ? Math.min(trip.days - 1, Math.max(1, 1)) : trip.days;

      stopRecords.push({
        tripId: params.tripId,
        placeId: l.placeId,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        address: l.address,
        category: "lodging",
        stopType: "LODGING",
        day: lodgingDay,
        sortOrder: sortedStops.length,
        durationMinutes: 45,
        rating: l.rating,
        reviewCount: l.reviewCount,
        photoUrl: l.photoUrl,
        reason: l.reason,
        evidence: {
          items: l.evidence,
          photoUrls: l.photoUrls,
          googleMapsUrl: l.googleMapsUrl,
          websiteUrl: l.websiteUrl,
        } as Prisma.InputJsonValue | undefined,
        weatherTag: l.weatherTag,
        selected: true,
      });
    }

    const orderedRecords = sortByRouteProgress(
      stopRecords.map((record) => ({
        ...record,
        lat: record.lat as number,
        lng: record.lng as number,
      })),
      corridor
    ).map((record, index) => ({ ...record, sortOrder: index }));

    await prisma.tripStop.createMany({ data: orderedRecords });

    return NextResponse.json({ success: true, count: orderedRecords.length });
  } catch (error) {
    console.error("PUT /api/trips/[tripId]/stops error:", error);
    return NextResponse.json({ error: "Duraklar kaydedilemedi" }, { status: 500 });
  }
}
