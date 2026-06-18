"use client";

import Image from "next/image";
import { Star, Clock, MapPin, Quote, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PoiRecommendation } from "@/types/trip";
import { POI_CATEGORIES } from "@/types/trip";

interface PoiCardProps {
  poi: PoiRecommendation;
  selected?: boolean;
  onToggle?: (placeId: string) => void;
  showSelect?: boolean;
}

function PlaceLinks({ poi }: { poi: PoiRecommendation }) {
  if (!poi.googleMapsUrl && !poi.websiteUrl) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {poi.googleMapsUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={poi.googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Google Maps
          </a>
        </Button>
      )}
      {poi.websiteUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={poi.websiteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Web sitesi
          </a>
        </Button>
      )}
    </div>
  );
}

function PlacePhotos({ poi }: { poi: PoiRecommendation }) {
  const photos = poi.photoUrls?.length ? poi.photoUrls : poi.photoUrl ? [poi.photoUrl] : [];
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {photos.map((url, index) => (
        <div key={`${poi.placeId}-photo-${index}`} className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
          <Image
            src={url}
            alt={`${poi.name} fotoğraf ${index + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}

export function PoiCard({ poi, selected = false, onToggle, showSelect = true }: PoiCardProps) {
  const categoryLabel =
    poi.category === "lodging"
      ? "Konaklama"
      : POI_CATEGORIES.find((c) => c.id === poi.category)?.label ?? poi.category;

  return (
    <Card className={`overflow-hidden transition-shadow ${selected ? "ring-2 ring-primary/30" : "opacity-70"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {showSelect && onToggle && (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle(poi.placeId)}
                className="mt-1"
              />
            )}
            <div>
              <CardTitle className="text-lg">{poi.name}</CardTitle>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="secondary">{categoryLabel}</Badge>
                {poi.rating && (
                  <Badge variant="outline" className="gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {poi.rating} ({poi.reviewCount?.toLocaleString("tr-TR")})
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />~{poi.durationMinutes} dk
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {poi.address && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {poi.address}
          </p>
        )}

        {poi.reason && (
          <div className="bg-accent/50 rounded-md p-3 text-sm">
            <p className="font-medium text-accent-foreground mb-1">Bu yüzden önerdim</p>
            <p>{poi.reason}</p>
          </div>
        )}

        {poi.evidence?.[0]?.snippet && (
          <div className="text-sm text-muted-foreground flex gap-2">
            <Quote className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="italic">&ldquo;{poi.evidence[0].snippet}&rdquo;</p>
          </div>
        )}

        {poi.weatherTag && <Badge variant="warning">{poi.weatherTag}</Badge>}

        <PlacePhotos poi={poi} />
        <PlaceLinks poi={poi} />
      </CardContent>
    </Card>
  );
}

interface LodgingCardProps {
  lodging: PoiRecommendation;
  selected?: boolean;
  onSelect?: (placeId: string) => void;
}

export function LodgingCard({ lodging, selected, onSelect }: LodgingCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={() => onSelect?.(lodging.placeId)}
    >
      {lodging.photoUrl && (
        <div className="relative w-full h-36 bg-muted">
          <Image
            src={lodging.photoUrl}
            alt={lodging.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>{lodging.name}</span>
          {lodging.rating && (
            <Badge variant="outline" className="gap-1 shrink-0">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {lodging.rating}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lodging.address && (
          <p className="text-sm text-muted-foreground">{lodging.address}</p>
        )}
        {lodging.reason && <p className="text-sm">{lodging.reason}</p>}
        {lodging.evidence?.[0]?.snippet && (
          <p className="text-xs text-muted-foreground italic">
            &ldquo;{lodging.evidence[0].snippet.slice(0, 120)}...&rdquo;
          </p>
        )}
        <div onClick={(event) => event.stopPropagation()}>
          <PlaceLinks poi={lodging} />
        </div>
        <Button variant={selected ? "default" : "outline"} size="sm" className="w-full">
          {selected ? "Seçildi" : "Seç"}
        </Button>
      </CardContent>
    </Card>
  );
}
