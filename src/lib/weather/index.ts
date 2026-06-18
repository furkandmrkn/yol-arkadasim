import type { WeatherSummary } from "@/types/trip";

const OWM_KEY = process.env.OPENWEATHER_API_KEY;

interface ForecastItem {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number };
  weather: { description: string; icon: string; main: string }[];
  pop?: number;
}

// Gezi/gündüz penceresi: bu saatler dışındaki (gece/şafak) yağışlar
// "yağmurlu gün" değerlendirmesine ve önerilere dahil edilmez.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const RAIN_POP_THRESHOLD = 0.4;

function formatHourLabel(dt: number): string {
  const hour = new Date(dt * 1000).getHours();
  return `${String(hour).padStart(2, "0")}:00`;
}

function isDaytime(dt: number): boolean {
  const hour = new Date(dt * 1000).getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

function isRainItem(item: ForecastItem): boolean {
  return (
    (item.pop ?? 0) >= RAIN_POP_THRESHOLD ||
    item.weather.some((w) => ["Rain", "Drizzle", "Thunderstorm"].includes(w.main))
  );
}

function buildDetailSummary(items: ForecastItem[]): {
  detailSummary: string;
  peakTemp?: number;
  peakTempLabel?: string;
  maxRainProbability?: number;
  rainTimeLabel?: string;
  isRainyDaytime: boolean;
} {
  if (items.length === 0) {
    return { detailSummary: "", isRainyDaytime: false };
  }

  const daytimeItems = items.filter((item) => isDaytime(item.dt));
  const dayItems = daytimeItems.length > 0 ? daytimeItems : items;

  const noonItem = dayItems.reduce((best, item) => {
    const hour = new Date(item.dt * 1000).getHours();
    const bestHour = new Date(best.dt * 1000).getHours();
    return Math.abs(hour - 12) < Math.abs(bestHour - 12) ? item : best;
  }, dayItems[0]);

  const peakItem = dayItems.reduce(
    (best, item) => (item.main.temp > best.main.temp ? item : best),
    dayItems[0]
  );

  // Yağmur değerlendirmesi yalnızca gündüz saatleri üzerinden yapılır.
  const rainyItems = daytimeItems
    .filter(isRainItem)
    .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0));

  const parts: string[] = [];

  if (noonItem) {
    parts.push(`Öğle saatlerinde yaklaşık ${Math.round(noonItem.main.temp)}°C`);
  }

  if (peakItem && peakItem.dt !== noonItem?.dt) {
    parts.push(
      `en yüksek sıcaklık ${formatHourLabel(peakItem.dt)} civarında ${Math.round(peakItem.main.temp)}°C`
    );
  }

  let maxRainProbability: number | undefined;
  let rainTimeLabel: string | undefined;
  const isRainyDaytime = rainyItems.length > 0;

  if (isRainyDaytime) {
    const topRain = rainyItems[0];
    maxRainProbability = Math.round((topRain.pop ?? 0.5) * 100);
    rainTimeLabel = formatHourLabel(topRain.dt);
    const rainHours = rainyItems
      .slice(0, 3)
      .map((item) => formatHourLabel(item.dt))
      .sort()
      .join(", ");
    parts.push(
      `gündüz saatlerinde yağmur riski var (${rainHours} civarı %${maxRainProbability} olasılık)`
    );
  } else {
    parts.push("gün içinde (08:00–20:00) belirgin yağış beklenmiyor");
  }

  return {
    detailSummary: parts.length > 0 ? `${parts.join("; ")}.` : "",
    peakTemp: Math.round(peakItem.main.temp),
    peakTempLabel: formatHourLabel(peakItem.dt),
    maxRainProbability,
    rainTimeLabel,
    isRainyDaytime,
  };
}

export async function getWeatherForecast(
  lat: number,
  lng: number,
  locationName: string,
  startDate: string,
  days: number
): Promise<WeatherSummary[]> {
  if (!OWM_KEY) {
    return mockWeather(locationName, startDate, days);
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("appid", OWM_KEY);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "tr");

  const res = await fetch(url.toString());
  if (!res.ok) return mockWeather(locationName, startDate, days);

  const data = await res.json();
  const start = new Date(startDate);
  const summaries: WeatherSummary[] = [];

  for (let d = 0; d < days; d++) {
    const target = new Date(start);
    target.setDate(target.getDate() + d);
    const dateStr = target.toISOString().split("T")[0];

    const dayItems = (data.list as ForecastItem[]).filter((item) => {
      const itemDate = new Date(item.dt * 1000).toISOString().split("T")[0];
      return itemDate === dateStr;
    });

    if (dayItems.length === 0) continue;

    const temps = dayItems.flatMap((i) => [i.main.temp_min, i.main.temp_max]);
    const main = dayItems[0].weather[0];
    const { isRainyDaytime, ...detail } = buildDetailSummary(dayItems);

    summaries.push({
      location: locationName,
      date: dateStr,
      tempMin: Math.round(Math.min(...temps)),
      tempMax: Math.round(Math.max(...temps)),
      description: main.description,
      icon: main.icon,
      isRainy: isRainyDaytime,
      isHot: Math.max(...temps) > 35,
      isCold: Math.min(...temps) < 5,
      ...detail,
    });
  }

  return summaries.length > 0 ? summaries : mockWeather(locationName, startDate, days);
}

function mockWeather(locationName: string, startDate: string, days: number): WeatherSummary[] {
  const summaries: WeatherSummary[] = [];
  const start = new Date(startDate);

  for (let d = 0; d < days; d++) {
    const target = new Date(start);
    target.setDate(target.getDate() + d);
    const isRainy = d % 4 === 0;
    summaries.push({
      location: locationName,
      date: target.toISOString().split("T")[0],
      tempMin: 12 + d,
      tempMax: 22 + d,
      description: d % 3 === 0 ? "Parçalı bulutlu" : "Açık",
      icon: d % 3 === 0 ? "02d" : "01d",
      isRainy,
      isHot: false,
      isCold: false,
      peakTemp: 20 + d,
      peakTempLabel: "14:00",
      maxRainProbability: isRainy ? 70 : undefined,
      rainTimeLabel: isRainy ? "18:00" : undefined,
      detailSummary: isRainy
        ? `Öğle saatlerinde yaklaşık ${20 + d}°C; akşam saatlerinde %70 yağmur olasılığı (18:00 civarı).`
        : `Öğle saatlerinde yaklaşık ${20 + d}°C; gün genelinde yağış beklenmiyor.`,
    });
  }

  return summaries;
}

export function getWeatherTagForPoi(
  category: string,
  weather?: WeatherSummary,
  cityName?: string
): string | undefined {
  if (!weather) return undefined;

  const prefix = cityName ? `${cityName} — ` : "";

  if (weather.isRainy) {
    if (["nature", "beach"].includes(category)) {
      return `${prefix}gün içinde yağmur ihtimali var, açık alan; yanınıza yağmurluk alın`;
    }
    if (["museum", "cave", "historic"].includes(category)) {
      return `${prefix}yağmurlu gün için uygun kapalı mekan`;
    }
  }

  if (weather.isHot && ["cave", "museum"].includes(category)) {
    return `${prefix}sıcak hava, serin kapalı mekan`;
  }

  if (weather.isHot && category === "beach") {
    return `${prefix}sıcak gün, plaj için ideal`;
  }

  return undefined;
}
