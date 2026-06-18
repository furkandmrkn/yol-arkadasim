"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

interface TripMapProps {
  origin?: { lat: number; lng: number; label?: string };
  destination?: { lat: number; lng: number; label?: string };
  stops?: { lat: number; lng: number; name: string; selected?: boolean; stopType?: string }[];
  polyline?: string;
  className?: string;
}

export function TripMap({ origin, destination, stops = [], polyline, className }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);

  const initMap = useCallback(async () => {
    if (!mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Harita için NEXT_PUBLIC_GOOGLE_MAPS_API_KEY gerekli. Demo modda liste görünümü kullanılabilir.");
      return;
    }

    try {
      const loader = new Loader({ apiKey, version: "weekly", language: "tr", region: "TR" });
      const { Map } = await loader.importLibrary("maps");
      const { Marker } = await loader.importLibrary("marker");
      const { Polyline } = await loader.importLibrary("maps");

      const center = origin ?? destination ?? { lat: 39.0, lng: 35.0 };
      const map = new Map(mapRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 7,
        mapTypeControl: false,
        streetViewControl: false,
      });
      googleMapRef.current = map;

      const bounds = new google.maps.LatLngBounds();
      const addMarker = (pos: { lat: number; lng: number }, title: string, color: string) => {
        new Marker({
          map,
          position: pos,
          title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        bounds.extend(pos);
      };

      if (origin) addMarker(origin, origin.label ?? "Başlangıç", "#22c55e");
      stops
        .filter((s) => s.selected !== false)
        .forEach((s) => {
          const color = s.stopType === "LODGING" ? "#a855f7" : "#0ea5e9";
          addMarker(s, s.name, color);
        });
      if (destination) addMarker(destination, destination.label ?? "Varış", "#ef4444");

      if (polyline) {
        const decoded = decodePolyline(polyline);
        if (decoded.length > 0) {
          new Polyline({ path: decoded, map, strokeColor: "#0ea5e9", strokeWeight: 4 });
          decoded.forEach((p) => bounds.extend(p));
        }
      }

      if (!bounds.isEmpty()) map.fitBounds(bounds, 60);
    } catch {
      setError("Harita yüklenemedi.");
    }
  }, [origin, destination, stops, polyline]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  if (error) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center p-8 text-center text-sm text-muted-foreground ${className}`}>
        <div>
          <p className="mb-2">{error}</p>
          {(origin || destination || stops.length > 0) && (
            <ul className="text-left inline-block space-y-1">
              {origin && <li>🟢 {origin.label ?? "Başlangıç"}</li>}
              {stops.map((s, i) => (
                <li key={i}>
                  {s.stopType === "LODGING" ? "🟣" : "🔵"} {s.name}
                </li>
              ))}
              {destination && <li>🔴 {destination.label ?? "Varış"}</li>}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={`rounded-lg min-h-[300px] md:min-h-[400px] ${className}`} />;
}
