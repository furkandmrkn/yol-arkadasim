import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTr(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return typeof date === "string" ? date : "";
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDateTr(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return format(d, "dd/MM/yyyy", { locale: tr });
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function buildGoogleMapsDirectionsUrl(
  origin: string,
  destination: string,
  waypoints: { lat: number; lng: number }[] = []
): string {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((wp) => `${wp.lat},${wp.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getIntensityStopCount(intensity?: "LOW" | "MEDIUM" | "HIGH"): number {
  switch (intensity) {
    case "LOW":
      return 3;
    case "HIGH":
      return 8;
    default:
      return 5;
  }
}

export const RECOMMENDATION_PAGE_SIZE = 5;
export const RECOMMENDATION_MAX_PAGES = 4;
