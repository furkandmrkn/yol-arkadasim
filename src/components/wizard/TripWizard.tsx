"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Info, RefreshCw, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { PoiCard, LodgingCard } from "@/components/cards/PoiCard";
import { CitySelect } from "@/components/wizard/CitySelect";
import { DatePicker } from "@/components/wizard/DatePicker";
import { SearchLoadingOverlay } from "@/components/wizard/SearchLoadingOverlay";
import { getLocationLabel } from "@/data/turkish-locations";
import { getRouteCityOptions } from "@/lib/route-utils";
import { formatShortDateTr, startOfDay } from "@/lib/utils";
import {
  BUDGET_OPTIONS,
  LODGING_AMENITY_OPTIONS,
  LODGING_PRICE_OPTIONS,
  buildRecommendationSummary,
  buildLodgingSearchSummary,
  getLocalVsTouristDescription,
} from "@/lib/wizard-labels";
import {
  tripWizardSchema,
  type TripWizardData,
  POI_CATEGORIES,
  FOOD_PREFERENCES,
  type PoiRecommendation,
} from "@/types/trip";
import { differenceInDays, parseISO } from "date-fns";

const STEPS = [
  "Rota & Tarih",
  "Grup & Tercihler",
  "Gezerek Git",
  "Öneriler",
  "Konaklama & Özet",
];

const defaultWizard: TripWizardData = {
  origin: "",
  destination: "",
  startDate: "",
  endDate: "",
  days: 1,
  adults: 2,
  childrenAges: [],
  hasBaby: false,
  transport: "CAR",
  budget: "MID",
  pace: "MODERATE",
  foodPreferences: [],
  exploreMode: false,
  exploreIntensity: "MEDIUM",
  categories: [],
  localVsTourist: 50,
  recommendationScope: "DESTINATION_ONLY",
  selectedRouteCities: [],
  lodgingNeeded: false,
  lodgingBreakfast: false,
  lodgingAmenities: [],
  lodgingScope: "DESTINATION_ONLY",
  selectedLodgingCities: [],
  lodgingType: "ANY",
  lodgingPriceRange: "MID",
};

const POI_PER_GROUP = 3;
const POI_MAX_PAGES = 4;

interface RecGroupState {
  key: string;
  category: string;
  categoryLabel: string;
  cityId: string;
  cityLabel: string;
  pages: PoiRecommendation[][];
  page: number;
  loading: boolean;
  exhausted: boolean;
}

function poiCategoryLabel(category: string): string {
  if (category === "general") return "Öneriler";
  return POI_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

export function TripWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<TripWizardData>(defaultWizard);
  const [childAgeInput, setChildAgeInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [recGroups, setRecGroups] = useState<RecGroupState[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [lodgingOptions, setLodgingOptions] = useState<PoiRecommendation[]>([]);
  const [selectedStops, setSelectedStops] = useState<Set<string>>(new Set());
  const [selectedLodging, setSelectedLodging] = useState<string | null>(null);
  const [lodgingLoading, setLodgingLoading] = useState(false);
  const [lodgingVariant, setLodgingVariant] = useState(0);
  const [lodgingSearchCity, setLodgingSearchCity] = useState<string | null>(null);
  const [lodgingSearched, setLodgingSearched] = useState(false);
  const [searchOverlay, setSearchOverlay] = useState<{ title: string; lines: string[] } | null>(null);

  const selectedPoiCategories = useMemo(
    () => (data.categories.length > 0 ? data.categories : ["general"]),
    [data.categories]
  );

  const selectedPoiCityIds = useMemo(() => {
    if (data.recommendationScope === "SELECTED_CITIES" && data.selectedRouteCities.length > 0) {
      return data.selectedRouteCities;
    }
    return data.destination ? [data.destination] : [];
  }, [data.recommendationScope, data.selectedRouteCities, data.destination]);

  const showCitySubgroups = selectedPoiCityIds.length > 1;

  const orderedCategories = useMemo(() => {
    const seen = new Set<string>();
    const result: { category: string; label: string }[] = [];
    for (const group of recGroups) {
      if (!seen.has(group.category)) {
        seen.add(group.category);
        result.push({ category: group.category, label: group.categoryLabel });
      }
    }
    return result;
  }, [recGroups]);

  const totalRecommendationCount = useMemo(
    () => recGroups.reduce((sum, g) => sum + g.pages.flat().length, 0),
    [recGroups]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [step]);

  const routeCityOptions = useMemo(() => {
    if (!data.origin || !data.destination) {
      return { intermediate: [], destination: undefined };
    }
    return getRouteCityOptions(data.origin, data.destination);
  }, [data.origin, data.destination]);

  const allSelectableCityIds = useMemo(() => {
    const ids = routeCityOptions.intermediate.map((city) => city.id);
    if (data.destination) ids.push(data.destination);
    return ids;
  }, [routeCityOptions, data.destination]);

  const update = (partial: Partial<TripWizardData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      if (partial.startDate || partial.endDate) {
        if (next.startDate && next.endDate) {
          const days = differenceInDays(parseISO(next.endDate), parseISO(next.startDate)) + 1;
          next.days = Math.max(1, days);
        }
      }
      return next;
    });
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!data.origin) newErrors.origin = "Başlangıç şehri seçin";
      if (!data.destination) newErrors.destination = "Varış şehri seçin";
      if (data.origin && data.destination && data.origin === data.destination) {
        newErrors.destination = "Varış, başlangıçtan farklı olmalı";
      }
      if (!data.startDate) newErrors.startDate = "Başlangıç tarihi seçin";
      if (!data.endDate) newErrors.endDate = "Bitiş tarihi seçin";
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        newErrors.endDate = "Bitiş tarihi, başlangıçtan önce olamaz";
      }
    }
    if (step === 2) {
      if (data.exploreMode) {
        if (data.categories.length === 0) {
          newErrors.categories = "En az bir kategori seçin";
        }
        if (
          data.recommendationScope === "SELECTED_CITIES" &&
          data.selectedRouteCities.length === 0
        ) {
          newErrors.routeCities = "En az bir şehir seçin";
        }
      }
      if (
        data.lodgingNeeded &&
        data.lodgingScope === "SELECTED_CITIES" &&
        data.selectedLodgingCities.length === 0
      ) {
        newErrors.lodgingCities = "Konaklama için en az bir şehir seçin";
      }
    }
    if (step === 3 && selectedStops.size === 0) {
      newErrors.stops = "Devam etmek için en az bir öneri seçin";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createTrip = async () => {
    const parsed = tripWizardSchema.safeParse(data);
    if (!parsed.success) return null;

    const payload = {
      ...parsed.data,
      origin: getLocationLabel(parsed.data.origin),
      destination: getLocationLabel(parsed.data.destination),
    };

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Trip oluşturulamadı");
    const trip = await res.json();
    setTripId(trip.id);
    return trip.id as string;
  };

  const fetchGroupedRecommendations = async (id: string) => {
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: id,
        mode: "grouped",
        categories: selectedPoiCategories,
        cities: selectedPoiCityIds,
        limit: POI_PER_GROUP,
        variant: 0,
      }),
    });
    if (!res.ok) throw new Error("Öneriler alınamadı");
    const result = await res.json();
    const groups = (result.groups ?? []) as {
      category: string;
      cityId: string;
      cityLabel: string;
      items: PoiRecommendation[];
    }[];

    const groupStates: RecGroupState[] = groups.map((g) => ({
      key: `${g.category}__${g.cityId}`,
      category: g.category,
      categoryLabel: poiCategoryLabel(g.category),
      cityId: g.cityId,
      cityLabel: g.cityLabel,
      pages: [g.items],
      page: 1,
      loading: false,
      exhausted: g.items.length < POI_PER_GROUP,
    }));

    setRecGroups(groupStates);
    setSelectedStops(new Set());
    setCollapsedCategories(new Set());
  };

  const loadGroupPage = async (groupKey: string, targetPage: number) => {
    const group = recGroups.find((g) => g.key === groupKey);
    if (!tripId || !group || group.loading) return;

    if (group.pages[targetPage - 1]) {
      setRecGroups((prev) =>
        prev.map((g) => (g.key === groupKey ? { ...g, page: targetPage } : g))
      );
      return;
    }

    setRecGroups((prev) =>
      prev.map((g) => (g.key === groupKey ? { ...g, loading: true } : g))
    );

    try {
      const excludePlaceIds = group.pages.flat().map((r) => r.placeId);
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          mode: "group",
          category: group.category,
          cityId: group.cityId,
          excludePlaceIds,
          limit: POI_PER_GROUP,
          variant: targetPage - 1,
        }),
      });
      if (!res.ok) throw new Error("Öneriler alınamadı");
      const result = await res.json();
      const items = (result.items ?? []) as PoiRecommendation[];

      setRecGroups((prev) =>
        prev.map((g) => {
          if (g.key !== groupKey) return g;
          if (items.length === 0) {
            return { ...g, loading: false, exhausted: true };
          }
          const pages = [...g.pages];
          pages[targetPage - 1] = items;
          return {
            ...g,
            pages,
            page: targetPage,
            loading: false,
            exhausted: items.length < POI_PER_GROUP,
          };
        })
      );
    } catch {
      setRecGroups((prev) =>
        prev.map((g) => (g.key === groupKey ? { ...g, loading: false } : g))
      );
      setErrors((prev) => ({
        ...prev,
        recommendations: "Bu grup için yeni öneri yüklenemedi.",
      }));
    }
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const fetchLodging = async (
    id: string,
    options?: { excludePlaceIds?: string[]; queryVariant?: number }
  ) => {
    const res = await fetch("/api/recommendations/lodging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: id,
        excludePlaceIds: options?.excludePlaceIds ?? [],
        queryVariant: options?.queryVariant ?? 0,
        lodgingAmenities: data.lodgingAmenities,
        lodgingScope: data.lodgingScope,
        selectedLodgingCities:
          data.lodgingScope === "SELECTED_CITIES" ? data.selectedLodgingCities : [],
      }),
    });
    if (!res.ok) throw new Error("Konaklama önerileri alınamadı");
    const result = await res.json();
    const lodging = (result.lodging ?? []) as PoiRecommendation[];
    setLodgingSearchCity(result.lodgingSearchCity ?? null);
    if (lodging.length === 0 && (options?.excludePlaceIds?.length ?? 0) > 0) {
      throw new Error("Başka konaklama bulunamadı. Filtreleri değiştirmeyi deneyin.");
    }
    setLodgingOptions(lodging);
    setSelectedLodging((current) => {
      if (current && lodging.some((item) => item.placeId === current)) {
        return current;
      }
      return lodging[0]?.placeId ?? null;
    });
  };

  const syncLodgingPrefs = useCallback(
    async (id: string) => {
      await fetch(`/api/trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lodgingNeeded: data.lodgingNeeded,
          lodgingBreakfast: data.lodgingAmenities.includes("BREAKFAST"),
          lodgingType: data.lodgingType,
          lodgingPriceRange: data.lodgingPriceRange,
        }),
      });
    },
    [data.lodgingNeeded, data.lodgingAmenities, data.lodgingType, data.lodgingPriceRange]
  );

  const loadLodging = useCallback(
    async (options?: { excludePlaceIds?: string[]; queryVariant?: number }) => {
      if (!tripId) return;
      setLodgingLoading(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.lodging;
        return next;
      });
      try {
        await syncLodgingPrefs(tripId);
        await fetchLodging(tripId, options);
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          lodging: error instanceof Error ? error.message : "Konaklama önerileri güncellenemedi.",
        }));
      } finally {
        setLodgingLoading(false);
      }
    },
    [tripId, syncLodgingPrefs, data.lodgingAmenities]
  );

  useEffect(() => {
    setLodgingSearched(false);
    setLodgingOptions([]);
    setSelectedLodging(null);
  }, [
    data.lodgingType,
    data.lodgingPriceRange,
    data.lodgingAmenities,
    data.lodgingScope,
    data.selectedLodgingCities,
  ]);

  const handleSearchLodging = async () => {
    if (!tripId || lodgingLoading) return;
    setLodgingSearched(true);
    setLodgingVariant(0);
    setSearchOverlay({
      title: "Konaklama yerleri aranıyor",
      lines: buildLodgingSearchSummary(data),
    });
    try {
      await loadLodging({ queryVariant: 0, excludePlaceIds: [] });
    } finally {
      setSearchOverlay(null);
    }
  };

  const handleRefreshRecommendations = async () => {
    if (!tripId || loading) return;
    setLoading(true);
    setSearchOverlay({
      title: "Öneriler yeniden aranıyor",
      lines: buildRecommendationSummary(data),
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.recommendations;
      return next;
    });
    try {
      await fetchGroupedRecommendations(tripId);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        recommendations: error instanceof Error ? error.message : "Öneriler yenilenemedi.",
      }));
    } finally {
      setSearchOverlay(null);
      setLoading(false);
    }
  };

  const handleRefreshLodging = () => {
    if (!tripId || lodgingLoading) return;
    const nextVariant = lodgingVariant + 1;
    setLodgingVariant(nextVariant);
    loadLodging({
      excludePlaceIds: lodgingOptions.map((item) => item.placeId),
      queryVariant: nextVariant,
    });
  };

  const toggleLodgingAmenity = (amenityId: TripWizardData["lodgingAmenities"][number]) => {
    const next = data.lodgingAmenities.includes(amenityId)
      ? data.lodgingAmenities.filter((item) => item !== amenityId)
      : [...data.lodgingAmenities, amenityId];
    update({
      lodgingAmenities: next,
      lodgingBreakfast: next.includes("BREAKFAST"),
    });
  };

  const saveStopsAndFinalize = async (id: string) => {
    const allRecommendations = recGroups.flatMap((g) => g.pages.flat());
    const uniqueRecommendations = new Map(
      allRecommendations.map((r) => [r.placeId, r] as const)
    );

    const stops = Array.from(uniqueRecommendations.values())
      .filter((r) => selectedStops.has(r.placeId))
      .map((r, i) => ({ ...r, sortOrder: i, selected: true }));

    const lodging = lodgingOptions.find((l) => l.placeId === selectedLodging);

    const stopsRes = await fetch(`/api/trips/${id}/stops`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stops, lodging }),
    });
    if (!stopsRes.ok) {
      throw new Error("Duraklar kaydedilemedi");
    }

    const routeRes = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: id }),
    });
    if (!routeRes.ok) {
      throw new Error("Rota hesaplanamadı");
    }

    router.push(`/plan/${id}`);
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    setLoading(true);
    try {
      if (step === 2) {
        let id = tripId;
        if (!id) id = await createTrip();
        if (id) {
          setSearchOverlay({
            title: "Öneriler aranıyor",
            lines: buildRecommendationSummary(data),
          });
          await fetchGroupedRecommendations(id);
          setSearchOverlay(null);
        }
        setStep(3);
      } else if (step === 3) {
        setStep(4);
      } else if (step === 4) {
        if (tripId) {
          setSearchOverlay({
            title: "Planınız hazırlanıyor",
            lines: [
              "Seçtiğiniz duraklar kaydediliyor",
              data.lodgingNeeded ? "Konaklama rotaya ekleniyor" : "Rota hesaplanıyor",
              "Google Maps bağlantısı oluşturuluyor",
            ],
          });
          await saveStopsAndFinalize(tripId);
        }
      } else {
        setStep((s) => s + 1);
      }
    } catch (e) {
      setSearchOverlay(null);
      setErrors({ general: e instanceof Error ? e.message : "Bir hata oluştu" });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const toggleLodgingCity = (cityId: string) => {
    const next = data.selectedLodgingCities.includes(cityId)
      ? data.selectedLodgingCities.filter((id) => id !== cityId)
      : [...data.selectedLodgingCities, cityId];
    update({ selectedLodgingCities: next });
  };

  const setLodgingScope = (scope: TripWizardData["lodgingScope"]) => {
    if (scope === "DESTINATION_ONLY") {
      update({
        lodgingScope: scope,
        selectedLodgingCities: data.destination ? [data.destination] : [],
      });
      return;
    }
    update({
      lodgingScope: scope,
      selectedLodgingCities:
        data.selectedLodgingCities.length > 0 ? data.selectedLodgingCities : allSelectableCityIds,
    });
  };

  const toggleRouteCity = (cityId: string) => {
    const next = data.selectedRouteCities.includes(cityId)
      ? data.selectedRouteCities.filter((id) => id !== cityId)
      : [...data.selectedRouteCities, cityId];
    update({ selectedRouteCities: next });
  };

  const setRecommendationScope = (scope: TripWizardData["recommendationScope"]) => {
    if (scope === "DESTINATION_ONLY") {
      update({
        recommendationScope: scope,
        selectedRouteCities: data.destination ? [data.destination] : [],
      });
      return;
    }
    update({
      recommendationScope: scope,
      selectedRouteCities:
        data.selectedRouteCities.length > 0 ? data.selectedRouteCities : allSelectableCityIds,
    });
  };

  const toggleCategory = (id: string) => {
    update({
      categories: data.categories.includes(id)
        ? data.categories.filter((c) => c !== id)
        : [...data.categories, id],
    });
  };

  const toggleFood = (pref: string) => {
    update({
      foodPreferences: data.foodPreferences.includes(pref)
        ? data.foodPreferences.filter((p) => p !== pref)
        : [...data.foodPreferences, pref],
    });
  };

  const addChild = () => {
    const age = parseInt(childAgeInput, 10);
    if (isNaN(age) || age < 0 || age > 17) return;
    update({ childrenAges: [...data.childrenAges, age] });
    setChildAgeInput("");
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Yeni Seyahat Planı</h1>
        <p className="text-muted-foreground text-sm mb-4">
          Adım {step + 1}/{STEPS.length}: {STEPS[step]}
        </p>
        <Progress value={progress} className="h-2" />
      </div>

      {errors.general && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {errors.general}
        </div>
      )}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nereye, ne zaman?</CardTitle>
            <CardDescription>Başlangıç ve varış noktanızı, seyahat tarihlerinizi girin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CitySelect
                id="origin"
                label="Nereden"
                value={data.origin}
                onChange={(id) => update({ origin: id })}
                excludeId={data.destination}
                error={errors.origin}
              />
              <CitySelect
                id="destination"
                label="Nereye"
                value={data.destination}
                onChange={(id) => update({ destination: id })}
                excludeId={data.origin}
                error={errors.destination}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DatePicker
                id="startDate"
                label="Başlangıç"
                value={data.startDate}
                onChange={(iso) => {
                  const next: Partial<TripWizardData> = { startDate: iso };
                  if (data.endDate && iso && data.endDate < iso) {
                    next.endDate = iso;
                  }
                  update(next);
                }}
                placeholder="gg/aa/yyyy"
                minDate={startOfDay(new Date())}
                error={errors.startDate}
              />
              <DatePicker
                id="endDate"
                label="Bitiş"
                value={data.endDate}
                onChange={(iso) => update({ endDate: iso })}
                placeholder="gg/aa/yyyy"
                minDate={
                  data.startDate ? startOfDay(parseISO(data.startDate)) : startOfDay(new Date())
                }
                error={errors.endDate}
              />
            </div>
            {data.days > 0 && (
              <p className="text-sm text-muted-foreground">Toplam: {data.days} gün</p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Grup ve tercihler</CardTitle>
            <CardDescription>Kaç kişi gidiyorsunuz, nasıl seyahat edeceksiniz?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Yetişkin sayısı</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={data.adults}
                  onChange={(e) => update({ adults: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={data.hasBaby} onCheckedChange={(v) => update({ hasBaby: v })} />
                <Label>Bebek var (0-2 yaş)</Label>
              </div>
            </div>

            <div>
              <Label>Çocuk yaşları</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  min={0}
                  max={17}
                  placeholder="Yaş"
                  value={childAgeInput}
                  onChange={(e) => setChildAgeInput(e.target.value)}
                  className="w-24"
                />
                <Button type="button" variant="outline" onClick={addChild}>
                  Ekle
                </Button>
              </div>
              {data.childrenAges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.childrenAges.map((age, i) => (
                    <span
                      key={i}
                      className="bg-secondary px-2 py-1 rounded text-sm cursor-pointer"
                      onClick={() =>
                        update({ childrenAges: data.childrenAges.filter((_, j) => j !== i) })
                      }
                    >
                      {age} yaş ✕
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Ulaşım</Label>
                <Select value={data.transport} onValueChange={(v) => update({ transport: v as TripWizardData["transport"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAR">Araba</SelectItem>
                    <SelectItem value="TRANSIT">Toplu taşıma</SelectItem>
                    <SelectItem value="WALK">Yürüyüş</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bütçe</Label>
                <Select value={data.budget} onValueChange={(v) => update({ budget: v as TripWizardData["budget"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUDGET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({option.range})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tempo</Label>
                <Select value={data.pace} onValueChange={(v) => update({ pace: v as TripWizardData["pace"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RELAXED">Rahat</SelectItem>
                    <SelectItem value="MODERATE">Orta</SelectItem>
                    <SelectItem value="PACKED">Yoğun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Yemek tercihleri</Label>
              <div className="flex flex-wrap gap-3">
                {FOOD_PREFERENCES.map((pref) => (
                  <label key={pref} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={data.foodPreferences.includes(pref)}
                      onCheckedChange={() => toggleFood(pref)}
                    />
                    {pref}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Gezerek git</CardTitle>
            <CardDescription>Yolda duraklar eklemek ister misiniz?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Gezerek git modu</Label>
                <p className="text-sm text-muted-foreground">Rota üzerinde gezilecek yerler önerilsin</p>
              </div>
              <Switch
                checked={data.exploreMode}
                onCheckedChange={(v) => {
                  if (v) {
                    update({
                      exploreMode: true,
                      recommendationScope: "DESTINATION_ONLY",
                      selectedRouteCities: data.destination ? [data.destination] : [],
                    });
                  } else {
                    update({ exploreMode: false });
                  }
                }}
              />
            </div>

            {data.exploreMode && (
              <>
                <div>
                  <Label>Gezi yoğunluğu</Label>
                  <Select
                    value={data.exploreIntensity}
                    onValueChange={(v) => update({ exploreIntensity: v as TripWizardData["exploreIntensity"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Az gezmeli (2-3 durak)</SelectItem>
                      <SelectItem value="MEDIUM">Orta (4-6 durak)</SelectItem>
                      <SelectItem value="HIGH">Çok gezmeli (7+ durak)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">Kategoriler</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {POI_CATEGORIES.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer text-sm ${
                          data.categories.includes(cat.id) ? "border-primary bg-accent" : ""
                        }`}
                      >
                        <Checkbox
                          checked={data.categories.includes(cat.id)}
                          onCheckedChange={() => toggleCategory(cat.id)}
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                  {errors.categories && (
                    <p className="text-xs text-destructive mt-1">{errors.categories}</p>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <div>
                    <Label className="text-base">Öneriler nerede aransın?</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getLocationLabel(data.origin)} → {getLocationLabel(data.destination)} rotası
                      üzerindeki şehirler:
                      {routeCityOptions.intermediate.length > 0
                        ? ` ${routeCityOptions.intermediate.map((c) => c.label).join(", ")}`
                        : " ara şehir bulunamadı"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label
                      className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                        data.recommendationScope === "DESTINATION_ONLY"
                          ? "border-primary bg-accent/40"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="recommendationScope"
                        className="mt-1"
                        checked={data.recommendationScope === "DESTINATION_ONLY"}
                        onChange={() => setRecommendationScope("DESTINATION_ONLY")}
                      />
                      <span>
                        <span className="font-medium text-sm block">Sadece varış noktasında</span>
                        <span className="text-xs text-muted-foreground">
                          Öneriler yalnızca {getLocationLabel(data.destination)} ve çevresinde aranır
                        </span>
                      </span>
                    </label>

                    <label
                      className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                        data.recommendationScope === "SELECTED_CITIES"
                          ? "border-primary bg-accent/40"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="recommendationScope"
                        className="mt-1"
                        checked={data.recommendationScope === "SELECTED_CITIES"}
                        onChange={() => setRecommendationScope("SELECTED_CITIES")}
                      />
                      <span>
                        <span className="font-medium text-sm block">Seçtiğim şehirlerde</span>
                        <span className="text-xs text-muted-foreground">
                          Yol üzerindeki illerden istediklerinizi işaretleyin
                        </span>
                      </span>
                    </label>
                  </div>

                  {data.recommendationScope === "SELECTED_CITIES" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {routeCityOptions.intermediate.map((city) => (
                        <label
                          key={city.id}
                          className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer text-sm ${
                            data.selectedRouteCities.includes(city.id)
                              ? "border-primary bg-accent/40"
                              : ""
                          }`}
                        >
                          <Checkbox
                            checked={data.selectedRouteCities.includes(city.id)}
                            onCheckedChange={() => toggleRouteCity(city.id)}
                          />
                          {city.label}
                        </label>
                      ))}
                      {data.destination && (
                        <label
                          className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer text-sm ${
                            data.selectedRouteCities.includes(data.destination)
                              ? "border-primary bg-accent/40"
                              : ""
                          }`}
                        >
                          <Checkbox
                            checked={data.selectedRouteCities.includes(data.destination)}
                            onCheckedChange={() => toggleRouteCity(data.destination)}
                          />
                          {getLocationLabel(data.destination)} (varış)
                        </label>
                      )}
                    </div>
                  )}
                  {errors.routeCities && (
                    <p className="text-xs text-destructive">{errors.routeCities}</p>
                  )}
                </div>

                <div>
                  <Label>Yerel ↔ Turistik</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground">Yerel</span>
                    <Slider
                      value={[data.localVsTourist]}
                      onValueChange={([v]) => update({ localVsTourist: v })}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">Turistik</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {getLocalVsTouristDescription(data.localVsTourist)}
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-base">Konaklama gerekli</Label>
                <p className="text-sm text-muted-foreground">Otel/pansiyon önerisi al</p>
              </div>
              <Switch
                checked={data.lodgingNeeded}
                onCheckedChange={(v) => {
                  if (v) {
                    update({
                      lodgingNeeded: true,
                      lodgingScope: "DESTINATION_ONLY",
                      selectedLodgingCities: data.destination ? [data.destination] : [],
                    });
                  } else {
                    update({ lodgingNeeded: false });
                  }
                }}
              />
            </div>

            {data.lodgingNeeded && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div>
                  <Label className="text-base">Konaklama nerede aransın?</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getLocationLabel(data.origin)} → {getLocationLabel(data.destination)} rotası
                    üzerindeki şehirler:
                    {routeCityOptions.intermediate.length > 0
                      ? ` ${routeCityOptions.intermediate.map((c) => c.label).join(", ")}`
                      : " ara şehir bulunamadı"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                      data.lodgingScope === "DESTINATION_ONLY"
                        ? "border-primary bg-accent/40"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="lodgingScope"
                      className="mt-1"
                      checked={data.lodgingScope === "DESTINATION_ONLY"}
                      onChange={() => setLodgingScope("DESTINATION_ONLY")}
                    />
                    <span>
                      <span className="font-medium text-sm block">Sadece varış noktasında</span>
                      <span className="text-xs text-muted-foreground">
                        Konaklama yalnızca {getLocationLabel(data.destination)} ve çevresinde aranır
                      </span>
                    </span>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                      data.lodgingScope === "SELECTED_CITIES"
                        ? "border-primary bg-accent/40"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="lodgingScope"
                      className="mt-1"
                      checked={data.lodgingScope === "SELECTED_CITIES"}
                      onChange={() => setLodgingScope("SELECTED_CITIES")}
                    />
                    <span>
                      <span className="font-medium text-sm block">Seçtiğim şehirlerde</span>
                      <span className="text-xs text-muted-foreground">
                        Yol üzerindeki illerden konaklamak istediklerinizi işaretleyin
                      </span>
                    </span>
                  </label>
                </div>

                {data.lodgingScope === "SELECTED_CITIES" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {routeCityOptions.intermediate.map((city) => (
                      <label
                        key={city.id}
                        className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer text-sm ${
                          data.selectedLodgingCities.includes(city.id)
                            ? "border-primary bg-accent/40"
                            : ""
                        }`}
                      >
                        <Checkbox
                          checked={data.selectedLodgingCities.includes(city.id)}
                          onCheckedChange={() => toggleLodgingCity(city.id)}
                        />
                        {city.label}
                      </label>
                    ))}
                    {data.destination && (
                      <label
                        className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer text-sm ${
                          data.selectedLodgingCities.includes(data.destination)
                            ? "border-primary bg-accent/40"
                            : ""
                        }`}
                      >
                        <Checkbox
                          checked={data.selectedLodgingCities.includes(data.destination)}
                          onCheckedChange={() => toggleLodgingCity(data.destination)}
                        />
                        {getLocationLabel(data.destination)} (varış)
                      </label>
                    )}
                  </div>
                )}
                {errors.lodgingCities && (
                  <p className="text-xs text-destructive">{errors.lodgingCities}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="border-primary/20 bg-accent/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tercihlerinize göre bulundu</CardTitle>
              <CardDescription>
                Aşağıdaki öneriler, önceki adımlarda seçtiğiniz kriterlere göre sıralandı.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {buildRecommendationSummary(data).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle>Size özel öneriler</CardTitle>
                  <CardDescription>
                    Beğendiğiniz önerileri işaretleyin. Seçim yapmadan devam edemezsiniz.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || !tripId}
                  onClick={handleRefreshRecommendations}
                  className="shrink-0"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Farklı öneriler
                </Button>
              </div>
            </CardHeader>
          </Card>
          {errors.recommendations && (
            <p className="text-sm text-destructive">{errors.recommendations}</p>
          )}
          {errors.stops && (
            <p className="text-sm text-destructive">{errors.stops}</p>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : totalRecommendationCount === 0 ? (
            <p className="text-center text-muted-foreground py-8">Öneri bulunamadı.</p>
          ) : (
            <div className="space-y-3">
              {orderedCategories.map(({ category, label }) => {
                const groupsForCategory = recGroups.filter((g) => g.category === category);
                const categoryCount = groupsForCategory.reduce(
                  (sum, g) => sum + g.pages.flat().length,
                  0
                );
                const isCollapsed = collapsedCategories.has(category);
                const visibleGroups = groupsForCategory.filter(
                  (g) => g.pages.flat().length > 0
                );

                return (
                  <Card key={category} className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(category)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-accent/40 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold">{label}</span>
                        <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                          {categoryCount} öneri
                        </span>
                      </span>
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="px-4 pb-4 space-y-5">
                        {visibleGroups.length === 0 && (
                          <p className="text-sm text-muted-foreground py-2">
                            Bu kategori için seçtiğiniz şehirlerde öneri bulunamadı.
                          </p>
                        )}
                        {visibleGroups.map((group) => {
                          const items = group.pages[group.page - 1] ?? [];
                          return (
                            <div key={group.key} className="space-y-3">
                              {showCitySubgroups && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {group.cityLabel}
                                  </span>
                                </div>
                              )}

                              <div className={group.loading ? "opacity-50 pointer-events-none" : ""}>
                                <div className="space-y-3">
                                  {items.map((poi) => (
                                    <PoiCard
                                      key={poi.placeId}
                                      poi={poi}
                                      selected={selectedStops.has(poi.placeId)}
                                      onToggle={(id) => {
                                        setSelectedStops((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(id)) next.delete(id);
                                          else next.add(id);
                                          return next;
                                        });
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  {Array.from(
                                    { length: Math.min(POI_MAX_PAGES, group.exhausted ? group.pages.length : group.pages.length + 1) },
                                    (_, i) => i + 1
                                  ).map((page) => (
                                    <Button
                                      key={page}
                                      type="button"
                                      size="sm"
                                      variant={group.page === page ? "default" : "outline"}
                                      disabled={group.loading}
                                      onClick={() => void loadGroupPage(group.key, page)}
                                    >
                                      {group.loading && group.page !== page ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        page
                                      )}
                                    </Button>
                                  ))}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {showCitySubgroups ? `${label} · ${group.cityLabel}` : label} · sayfa{" "}
                                  {group.page}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          {data.lodgingNeeded && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <CardTitle>Konaklama tercihleri</CardTitle>
                    <CardDescription>
                      Tip, bütçe ve istediğiniz özellikleri seçin, ardından önerileri getirin.
                      {lodgingSearched && lodgingSearchCity ? ` Arama: ${lodgingSearchCity}.` : ""}
                    </CardDescription>
                  </div>
                  {lodgingSearched && lodgingOptions.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={lodgingLoading || !tripId}
                      onClick={handleRefreshLodging}
                      className="shrink-0"
                    >
                      {lodgingLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Farklı öneriler
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Konaklama tipi</Label>
                    <Select
                      value={data.lodgingType}
                      disabled={lodgingLoading}
                      onValueChange={(v) => update({ lodgingType: v as TripWizardData["lodgingType"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANY">Fark etmez</SelectItem>
                        <SelectItem value="HOTEL">Otel</SelectItem>
                        <SelectItem value="PENSION">Pansiyon</SelectItem>
                        <SelectItem value="APART">Apart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gecelik bütçe</Label>
                    <Select
                      value={data.lodgingPriceRange}
                      disabled={lodgingLoading}
                      onValueChange={(v) => update({ lodgingPriceRange: v as TripWizardData["lodgingPriceRange"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LODGING_PRICE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label} ({option.range})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Tercih edilen özellikler (opsiyonel)</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {LODGING_AMENITY_OPTIONS.map((amenity) => (
                      <label
                        key={amenity.id}
                        className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer text-sm ${
                          data.lodgingAmenities.includes(amenity.id)
                            ? "border-primary bg-accent/40"
                            : ""
                        } ${lodgingLoading ? "opacity-60 pointer-events-none" : ""}`}
                      >
                        <Checkbox
                          checked={data.lodgingAmenities.includes(amenity.id)}
                          onCheckedChange={() => toggleLodgingAmenity(amenity.id)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium block">{amenity.label}</span>
                          <span className="text-xs text-muted-foreground">{amenity.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {!lodgingSearched && (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 py-8 px-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Tercihlerinizi seçtikten sonra konaklama önerilerini getirin.
                    </p>
                    <Button
                      type="button"
                      disabled={lodgingLoading || !tripId}
                      onClick={handleSearchLodging}
                    >
                      {lodgingLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Konaklama önerilerini getir
                    </Button>
                  </div>
                )}

                {lodgingSearched && lodgingLoading && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Konaklama önerileri güncelleniyor...
                  </div>
                )}

                {errors.lodging && (
                  <p className="text-sm text-destructive">{errors.lodging}</p>
                )}

                {!lodgingSearched ? null : lodgingLoading && lodgingOptions.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : lodgingOptions.length > 0 ? (
                  <div className={`relative pt-4 ${lodgingLoading ? "pointer-events-none" : ""}`}>
                    {lodgingLoading && (
                      <div className="absolute inset-0 z-10 rounded-lg bg-background/50" />
                    )}
                    <div className={`grid sm:grid-cols-2 gap-4 ${lodgingLoading ? "opacity-60" : ""}`}>
                      {lodgingOptions.map((l) => (
                        <LodgingCard
                          key={l.placeId}
                          lodging={l}
                          selected={selectedLodging === l.placeId}
                          onSelect={setSelectedLodging}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  !lodgingLoading && (
                    <p className="text-center text-muted-foreground py-8">
                      Bu filtrelere uygun konaklama bulunamadı.
                    </p>
                  )
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Plan özeti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Rota:</strong> {getLocationLabel(data.origin)} → {getLocationLabel(data.destination)}</p>
              <p><strong>Tarih:</strong> {formatShortDateTr(data.startDate)} — {formatShortDateTr(data.endDate)} ({data.days} gün)</p>
              <p><strong>Grup:</strong> {data.adults} yetişkin, {data.childrenAges.length} çocuk</p>
              <p><strong>Seçilen durak:</strong> {selectedStops.size} yer</p>
              <p className="text-muted-foreground pt-2">
                Planı oluştur dediğinizde rota hesaplanacak ve paylaşılabilir plan sayfasına yönlendirileceksiniz.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={handleBack} disabled={step === 0 || loading || !!searchOverlay}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Geri
        </Button>
        <Button onClick={handleNext} disabled={loading || lodgingLoading || !!searchOverlay}>
          {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {step === 4 ? "Planı Oluştur" : "İleri"}
          {step < 4 && !loading && <ArrowRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>

      {searchOverlay && (
        <SearchLoadingOverlay title={searchOverlay.title} lines={searchOverlay.lines} />
      )}
    </div>
  );
}
