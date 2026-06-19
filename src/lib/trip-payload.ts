import type { z } from "zod";
import { resolveTripCoordinates } from "@/lib/trip-coords";
import { tripWizardSchema } from "@/types/trip";

type TripWizardInput = z.infer<typeof tripWizardSchema>;

export type TripWizardPersistData = {
  planType: TripWizardInput["planType"];
  origin: string;
  destination: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  startDate: Date;
  endDate: Date;
  days: number;
  adults: number;
  childrenAges: number[];
  hasBaby: boolean;
  transport: TripWizardInput["transport"];
  budget: TripWizardInput["budget"];
  pace: TripWizardInput["pace"];
  foodPreferences: string[];
  exploreMode: boolean;
  exploreIntensity?: TripWizardInput["exploreIntensity"];
  categories: string[];
  localVsTourist: number;
  lodgingNeeded: boolean;
  lodgingBreakfast: boolean;
  lodgingType?: TripWizardInput["lodgingType"];
  lodgingPriceRange?: TripWizardInput["lodgingPriceRange"];
};

export async function buildPrismaTripDataFromWizard(
  data: TripWizardInput
): Promise<TripWizardPersistData> {
  const tripOrigin = data.planType === "CITY_DAY" ? data.destination : data.origin;
  const tripDestination = data.destination;

  const [originGeo, destGeo] = await Promise.all([
    resolveTripCoordinates(tripOrigin),
    resolveTripCoordinates(tripDestination),
  ]);

  return {
    planType: data.planType,
    origin: tripOrigin,
    destination: tripDestination,
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
    exploreMode: data.planType === "CITY_DAY" ? true : data.exploreMode,
    exploreIntensity: data.exploreIntensity,
    categories: data.categories,
    localVsTourist: data.localVsTourist,
    lodgingNeeded: data.planType === "CITY_DAY" ? false : data.lodgingNeeded,
    lodgingBreakfast: data.lodgingBreakfast,
    lodgingType: data.lodgingType,
    lodgingPriceRange: data.lodgingPriceRange,
  };
}

export { tripWizardSchema };
