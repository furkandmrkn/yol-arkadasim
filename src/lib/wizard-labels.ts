import { getLocationById, getLocationLabel } from "@/data/turkish-locations";
import { POI_CATEGORIES, type TripWizardData } from "@/types/trip";
import { getPaceRecommendationConfig, formatShortDateTr } from "@/lib/utils";

export const BUDGET_OPTIONS = [
  { value: "BUDGET", label: "Ekonomik", range: "günlük ~500–1.500 ₺ / kişi" },
  { value: "MID", label: "Orta", range: "günlük ~1.500–3.500 ₺ / kişi" },
  { value: "LUXURY", label: "Lüks", range: "günlük 3.500 ₺+ / kişi" },
] as const;

export const TRANSPORT_LABELS: Record<TripWizardData["transport"], string> = {
  CAR: "Araba",
  TRANSIT: "Toplu taşıma",
};

export const PACE_LABELS: Record<TripWizardData["pace"], string> = {
  RELAXED: "Rahat tempo",
  MODERATE: "Orta tempo",
  PACKED: "Yoğun tempo",
};

export const EXPLORE_INTENSITY_LABELS: Record<
  NonNullable<TripWizardData["exploreIntensity"]>,
  string
> = {
  LOW: "Az gezmeli (2–3 durak)",
  MEDIUM: "Orta (4–6 durak)",
  HIGH: "Çok gezmeli (7+ durak)",
};

export const LODGING_PRICE_OPTIONS = [
  { value: "LOW", label: "Ekonomik", range: "gecelik ~800–1.500 ₺" },
  { value: "MID", label: "Orta", range: "gecelik ~1.500–3.000 ₺" },
  { value: "HIGH", label: "Lüks", range: "gecelik 3.000 ₺+" },
] as const;

export const LODGING_AMENITY_OPTIONS = [
  {
    id: "BREAKFAST",
    label: "Kahvaltı dahil",
    hint: "Kahvaltısı övülen yerler öne çıkar",
  },
  {
    id: "POOL",
    label: "Havuz / spa",
    hint: "Havuz veya spa imkânı aranır",
  },
  {
    id: "FAMILY",
    label: "Aile dostu",
    hint: "Çocuklu gruplar için uygun yerler",
  },
  {
    id: "PARKING",
    label: "Otopark",
    hint: "Araçla seyahat edenler için",
  },
] as const;

export function getLodgingPriceLabel(value: NonNullable<TripWizardData["lodgingPriceRange"]>): string {
  const option = LODGING_PRICE_OPTIONS.find((item) => item.value === value);
  return option ? `${option.label} (${option.range})` : value;
}

export function getBudgetOptionLabel(value: TripWizardData["budget"]): string {
  const option = BUDGET_OPTIONS.find((item) => item.value === value);
  return option ? `${option.label} (${option.range})` : value;
}

export function getLocalVsTouristDescription(value: number): string {
  if (value <= 33) {
    return "Yerel odaklı — az bilinen, daha sakin duraklar önceliklendirilir.";
  }
  if (value >= 67) {
    return "Turistik odaklı — popüler ve çok ziyaret edilen yerler önceliklendirilir.";
  }
  return "Dengeli — hem yerel hem turistik noktalar karışık önerilir.";
}

export const PLAN_TYPE_LABELS: Record<TripWizardData["planType"], string> = {
  TRIP: "Seyahat planı",
  CITY_DAY: "Şehirde gez",
};

export function buildRecommendationSummary(data: TripWizardData): string[] {
  const lines: string[] = [];

  if (data.planType === "CITY_DAY") {
    lines.push(
      `${getLocationLabel(data.destination)} · ${formatShortDateTr(data.startDate)} · gün planı`
    );
  } else {
    lines.push(
      `Rota: ${getLocationLabel(data.origin)} → ${getLocationLabel(data.destination)} (${data.days} gün)`
    );
  }

  const groupParts = [`${data.adults} yetişkin`];
  if (data.childrenAges.length > 0) {
    groupParts.push(`${data.childrenAges.length} çocuk`);
  }
  if (data.hasBaby) {
    groupParts.push("bebek");
  }
  lines.push(`Grup: ${groupParts.join(", ")}`);

  lines.push(
    `Bütçe: ${getBudgetOptionLabel(data.budget)} · Tempo: ${PACE_LABELS[data.pace]} · Ulaşım: ${TRANSPORT_LABELS[data.transport]}`
  );

  if (data.foodPreferences.length > 0) {
    lines.push(`Yemek tercihleri: ${data.foodPreferences.join(", ")}`);
  }

  if (data.planType === "CITY_DAY") {
    const categories =
      data.categories.length > 0
        ? data.categories
            .map((id) => POI_CATEGORIES.find((cat) => cat.id === id)?.label ?? id)
            .join(", ")
        : `tempoya göre (${PACE_LABELS[data.pace].toLowerCase()})`;
    lines.push(`Kategoriler: ${categories}`);
    lines.push(`Yerel ↔ Turistik: ${getLocalVsTouristDescription(data.localVsTourist)}`);
  } else if (data.exploreMode) {
    const categories =
      data.categories.length > 0
        ? data.categories
            .map((id) => POI_CATEGORIES.find((cat) => cat.id === id)?.label ?? id)
            .join(", ")
        : "farketmez (karışık)";
    lines.push(
      `Gezerek git: ${data.exploreIntensity ? EXPLORE_INTENSITY_LABELS[data.exploreIntensity] : "açık"} · Kategoriler: ${categories}`
    );
    lines.push(`Yerel ↔ Turistik: ${getLocalVsTouristDescription(data.localVsTourist)}`);
    if (data.recommendationScope === "DESTINATION_ONLY") {
      lines.push(`Öneri kapsamı: Sadece varış — ${getLocationLabel(data.destination)}`);
    } else if (data.selectedRouteCities.length > 0) {
      const cityLabels = data.selectedRouteCities
        .map((id) => getLocationById(id)?.label ?? id)
        .join(", ");
      lines.push(`Öneri kapsamı: Seçilen şehirler — ${cityLabels}`);
    } else {
      lines.push("Öneri kapsamı: Rota üzerindeki seçili şehirler");
    }
  } else {
    const paceCfg = getPaceRecommendationConfig(data.pace);
    const categoryLabels = paceCfg.categories
      .map((id) => (id === "general" ? "popüler" : POI_CATEGORIES.find((c) => c.id === id)?.label ?? id))
      .join(", ");
    lines.push(
      `Gezerek git kapalı — ${getLocationLabel(data.destination)} bölgesinde ${PACE_LABELS[data.pace].toLowerCase()} ile ${categoryLabels} önerileri arandı.`
    );
  }

  if (data.lodgingNeeded) {
    if (data.lodgingScope === "DESTINATION_ONLY") {
      lines.push(`Konaklama: Sadece varış — ${getLocationLabel(data.destination)}`);
    } else if (data.selectedLodgingCities.length > 0) {
      const lodgingLabels = data.selectedLodgingCities
        .map((id) => getLocationById(id)?.label ?? id)
        .join(", ");
      lines.push(`Konaklama: Seçilen şehirler — ${lodgingLabels}`);
    } else {
      lines.push("Konaklama: Rota üzerindeki seçili şehirler");
    }
  }

  return lines;
}

export function buildLodgingSearchSummary(data: TripWizardData): string[] {
  const lines: string[] = [
    `Rota: ${getLocationLabel(data.origin)} → ${getLocationLabel(data.destination)}`,
  ];

  if (data.lodgingType && data.lodgingType !== "ANY") {
    const typeLabels: Record<string, string> = {
      HOTEL: "Otel",
      PENSION: "Pansiyon",
      APART: "Apart",
    };
    lines.push(`Konaklama tipi: ${typeLabels[data.lodgingType] ?? data.lodgingType}`);
  }

  if (data.lodgingPriceRange) {
    lines.push(`Gecelik bütçe: ${getLodgingPriceLabel(data.lodgingPriceRange)}`);
  }

  if (data.lodgingAmenities.length > 0) {
    const amenityLabels = data.lodgingAmenities
      .map((id) => LODGING_AMENITY_OPTIONS.find((a) => a.id === id)?.label ?? id)
      .join(", ");
    lines.push(`Özellikler: ${amenityLabels}`);
  }

  if (data.lodgingScope === "DESTINATION_ONLY") {
    lines.push(`Arama kapsamı: ${getLocationLabel(data.destination)}`);
  } else if (data.selectedLodgingCities.length > 0) {
    const cityLabels = data.selectedLodgingCities
      .map((id) => getLocationById(id)?.label ?? id)
      .join(", ");
    lines.push(`Arama kapsamı: ${cityLabels}`);
  }

  return lines;
}
