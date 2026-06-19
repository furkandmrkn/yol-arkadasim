import { z } from "zod";

export const POI_CATEGORIES = [
  { id: "museum", label: "Müze", googleType: "museum" },
  { id: "cave", label: "Mağara", googleType: "tourist_attraction" },
  { id: "nature", label: "Doğa", googleType: "park" },
  { id: "beach", label: "Plaj", googleType: "tourist_attraction" },
  { id: "historic", label: "Tarihi Yer", googleType: "tourist_attraction" },
  { id: "food", label: "Yeme-İçme", googleType: "restaurant" },
  { id: "shopping", label: "Alışveriş", googleType: "shopping_mall" },
  { id: "thermal", label: "Termal", googleType: "spa" },
] as const;

export type PoiCategoryId = (typeof POI_CATEGORIES)[number]["id"];

export const FOOD_PREFERENCES = [
  "Vejetaryen",
  "Vegan",
  "Helal",
  "Glutensiz",
  "Deniz ürünleri",
  "Yerel mutfak",
  "İçkili (alkollü) mekan",
  "İçkisiz (alkolsüz) mekan",
] as const;

export const recommendationEvidenceSchema = z.object({
  source: z.enum(["google_places", "wikipedia", "goturkiye", "llm_synthesis"]),
  snippet: z.string().max(200),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  url: z.string().optional(),
});

export type RecommendationEvidence = z.infer<typeof recommendationEvidenceSchema>;

export const PLAN_TYPES = ["TRIP", "CITY_DAY"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const tripWizardSchema = z
  .object({
  planType: z.enum(["TRIP", "CITY_DAY"]).default("TRIP"),
  origin: z.string().min(2, "Başlangıç noktası gerekli"),
  destination: z.string().min(2, "Varış noktası gerekli"),
  startDate: z.string().min(1, "Başlangıç tarihi gerekli"),
  endDate: z.string().min(1, "Bitiş tarihi gerekli"),
  days: z.number().int().min(1).max(30),

  adults: z.number().int().min(1).max(20),
  childrenAges: z.array(z.number().int().min(0).max(17)).default([]),
  hasBaby: z.boolean().default(false),

  transport: z.enum(["CAR", "TRANSIT"]).default("CAR"),
  budget: z.enum(["BUDGET", "MID", "LUXURY"]).default("MID"),
  pace: z.enum(["RELAXED", "MODERATE", "PACKED"]).default("MODERATE"),
  foodPreferences: z.array(z.string()).default([]),

  exploreMode: z.boolean().default(false),
  exploreIntensity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  categories: z.array(z.string()).default([]),
  localVsTourist: z.number().int().min(0).max(100).default(50),
  recommendationScope: z.enum(["DESTINATION_ONLY", "SELECTED_CITIES"]).default("DESTINATION_ONLY"),
  selectedRouteCities: z.array(z.string()).default([]),

  lodgingNeeded: z.boolean().default(false),
  lodgingBreakfast: z.boolean().default(false),
  lodgingAmenities: z
    .array(z.enum(["BREAKFAST", "POOL", "FAMILY", "PARKING"]))
    .default([]),
  lodgingScope: z.enum(["DESTINATION_ONLY", "SELECTED_CITIES"]).default("DESTINATION_ONLY"),
  selectedLodgingCities: z.array(z.string()).default([]),
  lodgingPlacement: z.enum(["DESTINATION", "MID_ROUTE"]).optional(),
  lodgingType: z.enum(["HOTEL", "PENSION", "APART", "ANY"]).optional(),
  lodgingPriceRange: z.enum(["LOW", "MID", "HIGH"]).optional(),
})
  .superRefine((data, ctx) => {
    if (data.planType === "TRIP") {
      if (data.origin === data.destination) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Varış, başlangıçtan farklı olmalı",
          path: ["destination"],
        });
      }
    }
    if (data.planType === "CITY_DAY" && data.lodgingNeeded) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gün planında konaklama seçilemez",
        path: ["lodgingNeeded"],
      });
    }
  });

export type TripWizardData = z.infer<typeof tripWizardSchema>;

export interface PoiRecommendation {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
  photoUrls?: string[];
  googleMapsUrl?: string;
  websiteUrl?: string;
  durationMinutes: number;
  score: number;
  reason: string;
  evidence: RecommendationEvidence[];
  weatherTag?: string;
  stopType?: string;
  day?: number;
  sortOrder?: number;
}

export interface LodgingRecommendation extends PoiRecommendation {
  priceLevel?: number;
  hasBreakfastHint?: boolean;
}

export interface RouteLeg {
  from: string;
  to: string;
  distanceText: string;
  durationText: string;
  durationMinutes: number;
}

export interface TimelineStop {
  name: string;
  time: string;
  durationMinutes: number;
  category?: string;
  kind?: "travel" | "visit" | "lodging";
  detail?: string;
}

export interface TimelineDay {
  day: number;
  date: string;
  stops: TimelineStop[];
  summary?: string;
}

export interface RouteSummary {
  legs: RouteLeg[];
  totalDistanceText: string;
  totalDurationText: string;
  polyline?: string;
  googleMapsUrl: string;
  timeline: TimelineDay[];
}

export interface WeatherSummary {
  location: string;
  date: string;
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  isRainy: boolean;
  isHot: boolean;
  isCold: boolean;
  detailSummary?: string;
  peakTemp?: number;
  peakTempLabel?: string;
  maxRainProbability?: number;
  rainTimeLabel?: string;
}

export interface TripDetailResponse {
  id: string;
  status: string;
  wizard: TripWizardData;
  stops: PoiRecommendation[];
  route?: RouteSummary;
  weather?: WeatherSummary[];
}
