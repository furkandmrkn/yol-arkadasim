"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  ExternalLink,
  CloudSun,
  Route as RouteIcon,
  Loader2,
  MapPin,
  Clock,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoiCard } from "@/components/cards/PoiCard";
import { formatDateTr, isCityDayPlan } from "@/lib/utils";
import type { RouteSummary, WeatherSummary, PoiRecommendation, TimelineStop } from "@/types/trip";
import type { TripWizardData } from "@/types/trip";
import { useSession } from "next-auth/react";
import { GuestSaveBanner } from "@/components/auth/GuestSaveBanner";

const TripMap = dynamic(
  () => import("@/components/map/TripMap").then((mod) => mod.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[300px] flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  }
);

interface TripData {
  id: string;
  status: string;
  wizard: TripWizardData;
  stops: PoiRecommendation[];
  route?: RouteSummary;
  weather?: WeatherSummary[];
  origin?: { lat: number; lng: number; label: string };
  destination?: { lat: number; lng: number; label: string };
}

export default function TripPlanPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { data: session } = useSession();

  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setError("Geçersiz plan adresi");
      setLoading(false);
      return;
    }

    fetch(`/api/trips/${tripId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Plan bulunamadı");
        }
        return res.json();
      })
      .then((data: TripData) => {
        setTrip({
          ...data,
          stops: (data.stops ?? []).map((stop) => ({
            ...stop,
            evidence: stop.evidence ?? [],
          })),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Plan yüklenemedi"))
      .finally(() => setLoading(false));
  }, [tripId]);

  const handleShare = async () => {
    const url = `${window.location.origin}/plan/${tripId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Linki kopyalayın:", url);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Planınız yükleniyor...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-destructive mb-4">{error ?? "Plan bulunamadı"}</p>
        <Button asChild>
          <Link href="/plan/new">Yeni Plan Oluştur</Link>
        </Button>
      </div>
    );
  }

  const poiStops = trip.stops.filter((s) => s.stopType !== "LODGING");
  const lodging = trip.stops.find((s) => s.stopType === "LODGING");
  const allStops = [...trip.stops].sort((a, b) => {
    if (a.day !== b.day) return (a.day ?? 1) - (b.day ?? 1);
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  const mapStops = allStops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
    name: s.name,
    stopType: s.stopType,
  }));
  const route = trip.route;
  const weather = trip.weather;

  const formatDuration = (stop: TimelineStop) => {
    if (stop.kind === "travel") {
      const hours = Math.floor(stop.durationMinutes / 60);
      const mins = stop.durationMinutes % 60;
      if (hours > 0) return `~${hours} sa ${mins > 0 ? `${mins} dk` : ""}`.trim();
      return `~${stop.durationMinutes} dk`;
    }
    if (stop.kind === "lodging") return "Giriş / geceleme";
    return `~${stop.durationMinutes} dk`;
  };

  const cityDay = isCityDayPlan(trip.wizard);
  const isDraft = trip.status === "DRAFT";

  return (
    <div className="container mx-auto px-4 py-8">
      {isDraft && (
        <Card className="mb-6 border-dashed border-primary/40 bg-accent/20">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium">Bu plan henüz tamamlanmadı</p>
              <p className="text-sm text-muted-foreground">
                Öneri seçimi ve özet adımlarından kaldığınız yerden devam edebilirsiniz.
              </p>
            </div>
            <Button asChild>
              <Link href={`/plan/new?tripId=${tripId}`}>
                <Pencil className="h-4 w-4 mr-1" />
                Planı tamamla
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/plan/new">
              <ArrowLeft className="h-4 w-4 mr-1" /> Yeni plan
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">
            {cityDay
              ? `${trip.wizard.destination}'da gün planı`
              : `${trip.wizard.origin} → ${trip.wizard.destination}`}
          </h1>
          <p className="text-muted-foreground">
            {cityDay ? (
              <>
                {formatDateTr(trip.wizard.startDate)} · {trip.wizard.adults} yetişkin
                {trip.wizard.childrenAges.length > 0 && ` · ${trip.wizard.childrenAges.length} çocuk`}
              </>
            ) : (
              <>
                {formatDateTr(trip.wizard.startDate)} — {formatDateTr(trip.wizard.endDate)} ·{" "}
                {trip.wizard.days} gün · {trip.wizard.adults} yetişkin
                {trip.wizard.childrenAges.length > 0 && ` · ${trip.wizard.childrenAges.length} çocuk`}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            {copied ? "Kopyalandı!" : "Paylaş"}
          </Button>
          {route?.googleMapsUrl && (
            <Button asChild>
              <a href={route.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Google Maps
              </a>
            </Button>
          )}
        </div>
      </div>

      {!session?.user && <GuestSaveBanner className="mb-8" />}

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {route && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <RouteIcon className="h-4 w-4" /> {cityDay ? "Gün Özeti" : "Rota Özeti"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{route.totalDistanceText}</p>
              <p className="text-sm text-muted-foreground">{route.totalDurationText}</p>
              <p className="text-xs text-muted-foreground mt-1">{allStops.length} durak</p>
            </CardContent>
          </Card>
        )}

        {lodging && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Konaklama
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{lodging.name}</p>
              {lodging.address && (
                <p className="text-sm text-muted-foreground">{lodging.address}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mb-8 overflow-hidden">
        <CardHeader>
          <CardTitle>Harita</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TripMap
            origin={
              trip.origin?.lat != null
                ? { lat: trip.origin.lat, lng: trip.origin.lng!, label: trip.origin.label }
                : undefined
            }
            destination={
              trip.destination?.lat != null
                ? {
                    lat: trip.destination.lat,
                    lng: trip.destination.lng!,
                    label: trip.destination.label,
                  }
                : undefined
            }
            stops={mapStops}
            polyline={route?.polyline}
            className="w-full"
          />
        </CardContent>
      </Card>

      {route?.timeline && route.timeline.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Gün Gün Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {route.timeline.map((day) => (
              <div key={day.day}>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge>Gün {day.day}</Badge>
                  <span className="text-sm text-muted-foreground font-normal">
                    {formatDateTr(day.date)}
                  </span>
                </h3>
                {day.stops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu gün için durak yok.</p>
                ) : (
                  <>
                    <ul className="space-y-2 border-l-2 border-primary/20 pl-4 ml-2">
                      {day.stops.map((stop, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{stop.time}</span>
                          <span className="mx-2">—</span>
                          {stop.kind === "travel" && (
                            <span className="text-muted-foreground">🚗 </span>
                          )}
                          {stop.kind === "lodging" && (
                            <span className="text-muted-foreground">🏨 </span>
                          )}
                          {stop.name}
                          <span className="text-muted-foreground ml-2 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(stop)}
                          </span>
                          {stop.detail && (
                            <span className="block text-xs text-muted-foreground ml-0 mt-0.5 pl-0">
                              {stop.detail}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {day.summary && (
                      <p className="text-xs text-muted-foreground mt-2 pl-6">{day.summary}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {weather && weather.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5" /> Hava Durumu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {weather.map((w) => (
                <div key={w.date} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{formatDateTr(w.date)}</p>
                  {w.location && (
                    <p className="text-xs font-medium text-primary flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {w.location}
                    </p>
                  )}
                  <p className="font-medium text-sm mt-1">{w.description}</p>
                  <p className="text-xs">
                    {w.tempMin}° — {w.tempMax}°
                  </p>
                  {w.isRainy && (
                    <Badge variant="warning" className="mt-2">
                      Yağmur ihtimali
                      {w.maxRainProbability
                        ? ` · %${w.maxRainProbability}${w.rainTimeLabel ? ` (${w.rainTimeLabel})` : ""}`
                        : ""}
                    </Badge>
                  )}
                  {w.detailSummary && (
                    <p className="text-xs text-muted-foreground mt-2 leading-snug">{w.detailSummary}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Duraklar</h2>
        {allStops.length === 0 ? (
          <p className="text-muted-foreground">Henüz durak eklenmemiş.</p>
        ) : (
          allStops.map((poi) => (
            <div key={poi.placeId} className="relative">
              {poi.stopType === "LODGING" && (
                <Badge className="absolute -top-2 left-4 z-10" variant="secondary">
                  Konaklama
                </Badge>
              )}
              <PoiCard poi={poi} showSelect={false} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
