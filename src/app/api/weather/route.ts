import { NextResponse } from "next/server";
import { getWeatherForecast } from "@/lib/weather";
import { geocodeAddress } from "@/lib/google/maps";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");
    const startDate = searchParams.get("startDate");
    const days = parseInt(searchParams.get("days") ?? "1", 10);

    if (!location || !startDate) {
      return NextResponse.json({ error: "location ve startDate gerekli" }, { status: 400 });
    }

    const geo = await geocodeAddress(location);
    if (!geo) {
      return NextResponse.json({ error: "Konum bulunamadı" }, { status: 404 });
    }

    const weather = await getWeatherForecast(
      geo.lat,
      geo.lng,
      location,
      startDate,
      days
    );

    return NextResponse.json({ weather });
  } catch (error) {
    console.error("GET /api/weather error:", error);
    return NextResponse.json({ error: "Hava durumu alınamadı" }, { status: 500 });
  }
}
