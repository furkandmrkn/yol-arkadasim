import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import type { TripWizardData } from "@/types/trip";

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

/** Gezerek git kapalıyken varış noktası önerileri tempoya göre ölçeklenir. */
export function getPaceRecommendationConfig(pace: "RELAXED" | "MODERATE" | "PACKED") {
  switch (pace) {
    case "RELAXED":
      return { perGroup: 2, maxPages: 2, categories: ["general"] as const };
    case "PACKED":
      return {
        perGroup: 4,
        maxPages: 4,
        categories: ["general", "food", "museum", "historic"] as const,
      };
    default:
      return { perGroup: 3, maxPages: 3, categories: ["general", "food"] as const };
  }
}

export function resolveRecommendationCategories(
  wizard: Pick<TripWizardData, "exploreMode" | "categories" | "pace" | "planType">
): string[] {
  if (wizard.planType === "CITY_DAY") {
    if (wizard.categories.length > 0) return wizard.categories;
    return [...getPaceRecommendationConfig(wizard.pace).categories];
  }
  if (wizard.exploreMode) {
    return wizard.categories.length > 0 ? wizard.categories : ["general"];
  }
  return [...getPaceRecommendationConfig(wizard.pace).categories];
}

export function getRecommendationMaxPages(
  wizard: Pick<TripWizardData, "exploreMode" | "pace" | "planType">,
  fallback = 4
): number {
  if (wizard.planType === "CITY_DAY" || !wizard.exploreMode) {
    return getPaceRecommendationConfig(wizard.pace).maxPages;
  }
  return fallback;
}

export function getRecommendationPerGroupLimit(
  wizard: Pick<TripWizardData, "exploreMode" | "pace" | "planType">,
  fallback = 3
): number {
  if (wizard.planType === "CITY_DAY" || !wizard.exploreMode) {
    return getPaceRecommendationConfig(wizard.pace).perGroup;
  }
  return fallback;
}

export function isCityDayPlan(
  wizard: Pick<TripWizardData, "planType">
): boolean {
  return wizard.planType === "CITY_DAY";
}

export const RECOMMENDATION_PAGE_SIZE = 5;
export const RECOMMENDATION_MAX_PAGES = 4;
