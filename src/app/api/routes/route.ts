import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTripForModify } from "@/lib/trip-auth";
import { getDirections } from "@/lib/google/maps";
import { buildGoogleMapsDirectionsUrl } from "@/lib/utils";
import { getWeatherForecast } from "@/lib/weather";
import { getNearestLocation } from "@/data/turkish-locations";
import {
  filterAlongRoute,
  sortByRouteProgress,
  type RouteCorridor,
} from "@/lib/route-utils";
import type { RouteSummary, TimelineDay, TimelineStop, WeatherSummary } from "@/types/trip";

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function visitDurationMinutes(
  durationMinutes: number,
  stopType: string,
  category?: string | null
): number {
  if (stopType === "LODGING") return 45;
  if (durationMinutes > 0) return durationMinutes;
  if (category === "food") return 60;
  if (category === "museum") return 90;
  return 75;
}

function buildTimeline(
  stops: {
    name: string;
    day: number;
    durationMinutes: number;
    category?: string | null;
    stopType: string;
    sortOrder: number;
  }[],
  startDate: Date,
  days: number,
  originName: string,
  legs: { durationMinutes: number; from: string; to: string }[],
  options?: { cityDay?: boolean }
): TimelineDay[] {
  const routeOrdered = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const timeline: TimelineDay[] = [];

  for (let d = 1; d <= days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d - 1);

    const dayStops = routeOrdered
      .filter((s) => s.day === d)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const entries: TimelineStop[] = [];
    let clock = d === 1 ? 7 * 60 : 9 * 60;

    for (const stop of dayStops) {
      const routeIndex = routeOrdered.findIndex(
        (s) => s.name === stop.name && s.sortOrder === stop.sortOrder
      );
      const leg = legs[routeIndex];
      const travelMinutes = leg?.durationMinutes ?? 45;

      if (routeIndex === 0 && d === 1) {
        entries.push({
          kind: "travel",
          name: options?.cityDay ? `${originName} · ${stop.name}` : `${originName} → ${stop.name}`,
          time: formatTime(clock),
          durationMinutes: travelMinutes,
          detail: options?.cityDay
            ? `İlk durağa ulaşım (~${travelMinutes} dk)`
            : `Başlangıç noktasından yolculuk (~${travelMinutes} dk)`,
        });
        clock += travelMinutes + 15;
      } else if (routeIndex > 0) {
        entries.push({
          kind: "travel",
          name: `${routeOrdered[routeIndex - 1]?.name ?? "Önceki durak"} → ${stop.name}`,
          time: formatTime(clock),
          durationMinutes: travelMinutes,
          detail: `Duraklar arası yolculuk (~${travelMinutes} dk)`,
        });
        clock += travelMinutes + 10;
      }

      const visitMin = visitDurationMinutes(stop.durationMinutes, stop.stopType, stop.category);
      const isLodging = stop.stopType === "LODGING";

      entries.push({
        kind: isLodging ? "lodging" : "visit",
        name: stop.name,
        time: formatTime(clock),
        durationMinutes: visitMin,
        category: stop.category ?? undefined,
        detail: isLodging ? "Giriş ve yerleşme" : undefined,
      });

      clock += visitMin + (isLodging ? 30 : 20);
    }

    const summary =
      dayStops.length === 0
        ? undefined
        : `Tahmini ${dayStops.length} durak · gün ${formatTime(clock)} civarında tamamlanır`;

    timeline.push({
      day: d,
      date: date.toISOString().split("T")[0],
      stops: entries,
      summary,
    });
  }

  return timeline;
}

export async function POST(request: Request) {
  try {
    const { tripId } = await request.json();
    if (!tripId) {
      return NextResponse.json({ error: "tripId gerekli" }, { status: 400 });
    }

    const access = await getTripForModify(tripId);
    if (!access.ok) return access.response;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { stops: { where: { selected: true }, orderBy: { sortOrder: "asc" } } },
    });

    if (!trip) {
      return NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 });
    }

    const corridor: RouteCorridor = {
      originLat: trip.originLat ?? 39,
      originLng: trip.originLng ?? 35,
      destLat: trip.destLat ?? 39,
      destLng: trip.destLng ?? 35,
    };

    const isCityDay = trip.planType === "CITY_DAY";

    const poiStops = isCityDay
      ? trip.stops.filter((s) => s.stopType === "POI" || s.stopType === "LODGING")
      : filterAlongRoute(
          trip.stops.filter((s) => s.stopType === "POI" || s.stopType === "LODGING"),
          corridor,
          85
        );

    const sortedPoiStops = isCityDay
      ? [...poiStops].sort((a, b) => a.sortOrder - b.sortOrder)
      : sortByRouteProgress(poiStops, corridor);
    const waypoints = sortedPoiStops.map((s) => ({ lat: s.lat, lng: s.lng }));

    const mode =
      trip.transport === "TRANSIT"
        ? "transit"
        : "driving";

    const directions = await getDirections(
      trip.origin,
      trip.destination,
      waypoints,
      mode as "driving" | "walking" | "transit"
    );

    const googleMapsUrl = buildGoogleMapsDirectionsUrl(
      trip.origin,
      trip.destination,
      waypoints
    );

    const timeline = buildTimeline(
      trip.stops.map((s) => ({
        name: s.name,
        day: s.day,
        durationMinutes: s.durationMinutes,
        category: s.category,
        stopType: s.stopType,
        sortOrder: s.sortOrder,
      })),
      trip.startDate,
      trip.days,
      trip.origin,
      directions?.legs ?? [],
      { cityDay: isCityDay }
    );

    const routeSummary: RouteSummary = {
      legs: directions?.legs ?? [],
      totalDistanceText: isCityDay ? "Şehir içi" : (directions?.totalDistanceText ?? "—"),
      totalDurationText: isCityDay
        ? `${sortedPoiStops.length} durak · tempoya göre`
        : (directions?.totalDurationText ?? "—"),
      polyline: directions?.polyline,
      googleMapsUrl,
      timeline,
    };

    // Her gün için, o günün ilk durağının bulunduğu şehre göre hava durumu hesaplanır.
    // Böylece (ör. sabah Isparta'dayken) gösterilen hava o şehre denk gelir.
    const dailyWeather = await Promise.all(
      Array.from({ length: trip.days }, async (_, i) => {
        const day = i + 1;
        const date = new Date(trip.startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];

        const firstStop = trip.stops
          .filter((s) => s.day === day)
          .sort((a, b) => a.sortOrder - b.sortOrder)[0];

        const lat = firstStop?.lat ?? trip.destLat ?? 39;
        const lng = firstStop?.lng ?? trip.destLng ?? 35;
        const city = getNearestLocation(lat, lng);

        const forecast = await getWeatherForecast(lat, lng, city.label, dateStr, 1);
        const summary = forecast[0];
        if (summary) return { ...summary, date: dateStr, location: city.label };

        return {
          location: city.label,
          date: dateStr,
          tempMin: 0,
          tempMax: 0,
          description: "—",
          icon: "01d",
          isRainy: false,
          isHot: false,
          isCold: false,
        } satisfies WeatherSummary;
      })
    );

    await prisma.trip.update({
      where: { id: tripId },
      data: {
        routeSummary: routeSummary as object,
        weatherSummary: dailyWeather as object[],
        status: "PLANNED",
      },
    });

    return NextResponse.json({ route: routeSummary });
  } catch (error) {
    console.error("POST /api/routes error:", error);
    return NextResponse.json({ error: "Rota hesaplanamadı" }, { status: 500 });
  }
}
