export interface TurkishLocation {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface LocationGroup {
  region: string;
  locations: TurkishLocation[];
}

export const TURKISH_LOCATION_GROUPS: LocationGroup[] = [
  {
    region: "Marmara",
    locations: [
      { id: "istanbul", label: "İstanbul", lat: 41.0082, lng: 28.9784 },
      { id: "bursa", label: "Bursa", lat: 40.1885, lng: 29.0610 },
      { id: "canakkale", label: "Çanakkale", lat: 40.1553, lng: 26.4142 },
      { id: "edirne", label: "Edirne", lat: 41.6771, lng: 26.5557 },
      { id: "tekirdag", label: "Tekirdağ", lat: 40.9780, lng: 27.5110 },
      { id: "balikesir", label: "Balıkesir", lat: 39.6484, lng: 27.8826 },
      { id: "kocaeli", label: "Kocaeli (İzmit)", lat: 40.7654, lng: 29.9408 },
      { id: "sakarya", label: "Sakarya", lat: 40.7569, lng: 30.3783 },
      { id: "yalova", label: "Yalova", lat: 40.6500, lng: 29.2762 },
      { id: "kirklareli", label: "Kırklareli", lat: 41.7333, lng: 27.2167 },
    ],
  },
  {
    region: "Ege",
    locations: [
      { id: "izmir", label: "İzmir", lat: 38.4237, lng: 27.1428 },
      { id: "aydin", label: "Aydın", lat: 37.8560, lng: 27.8416 },
      { id: "denizli", label: "Denizli", lat: 37.7765, lng: 29.0864 },
      { id: "mugla", label: "Muğla", lat: 37.2153, lng: 28.3636 },
      { id: "bodrum", label: "Bodrum", lat: 37.0344, lng: 27.4305 },
      { id: "fethiye", label: "Fethiye", lat: 36.6213, lng: 29.1164 },
      { id: "marmaris", label: "Marmaris", lat: 36.8550, lng: 28.2742 },
      { id: "kusadasi", label: "Kuşadası", lat: 37.8579, lng: 27.2610 },
      { id: "cesme", label: "Çeşme", lat: 38.3228, lng: 26.3066 },
      { id: "manisa", label: "Manisa", lat: 38.6191, lng: 27.4289 },
      { id: "usak", label: "Uşak", lat: 38.6823, lng: 29.4082 },
      { id: "kutahya", label: "Kütahya", lat: 39.4167, lng: 29.9833 },
      { id: "afyon", label: "Afyonkarahisar", lat: 38.7507, lng: 30.5567 },
    ],
  },
  {
    region: "Akdeniz",
    locations: [
      { id: "antalya", label: "Antalya", lat: 36.8969, lng: 30.7133 },
      { id: "alanya", label: "Alanya", lat: 36.5444, lng: 31.9954 },
      { id: "kemer", label: "Kemer", lat: 36.5971, lng: 30.5604 },
      { id: "side", label: "Side", lat: 36.7667, lng: 31.3889 },
      { id: "adana", label: "Adana", lat: 37.0000, lng: 35.3213 },
      { id: "mersin", label: "Mersin", lat: 36.8121, lng: 34.6415 },
      { id: "hatay", label: "Hatay (Antakya)", lat: 36.2025, lng: 36.1604 },
      { id: "isparta", label: "Isparta", lat: 37.7648, lng: 30.5566 },
      { id: "burdur", label: "Burdur", lat: 37.7203, lng: 30.2908 },
      { id: "kahramanmaras", label: "Kahramanmaraş", lat: 37.5858, lng: 36.9371 },
      { id: "osmaniye", label: "Osmaniye", lat: 37.0742, lng: 36.2478 },
    ],
  },
  {
    region: "İç Anadolu",
    locations: [
      { id: "ankara", label: "Ankara", lat: 39.9334, lng: 32.8597 },
      { id: "kapadokya", label: "Kapadokya (Göreme)", lat: 38.6431, lng: 34.8289 },
      { id: "nevsehir", label: "Nevşehir", lat: 38.6244, lng: 34.7239 },
      { id: "konya", label: "Konya", lat: 37.8746, lng: 32.4932 },
      { id: "kayseri", label: "Kayseri", lat: 38.7312, lng: 35.4787 },
      { id: "sivas", label: "Sivas", lat: 39.7477, lng: 37.0179 },
      { id: "eskisehir", label: "Eskişehir", lat: 39.7767, lng: 30.5206 },
      { id: "aksaray", label: "Aksaray", lat: 38.3687, lng: 34.0370 },
      { id: "nigde", label: "Niğde", lat: 37.9667, lng: 34.6833 },
      { id: "kirsehir", label: "Kırşehir", lat: 39.1425, lng: 34.1709 },
      { id: "yozgat", label: "Yozgat", lat: 39.8181, lng: 34.8147 },
      { id: "karaman", label: "Karaman", lat: 37.1759, lng: 33.2287 },
      { id: "cankiri", label: "Çankırı", lat: 40.6013, lng: 33.6134 },
    ],
  },
  {
    region: "Karadeniz",
    locations: [
      { id: "trabzon", label: "Trabzon", lat: 41.0027, lng: 39.7168 },
      { id: "rize", label: "Rize", lat: 41.0201, lng: 40.5234 },
      { id: "samsun", label: "Samsun", lat: 41.2867, lng: 36.3300 },
      { id: "ordu", label: "Ordu", lat: 40.9839, lng: 37.8764 },
      { id: "giresun", label: "Giresun", lat: 40.9128, lng: 38.3895 },
      { id: "amasya", label: "Amasya", lat: 40.6499, lng: 35.8353 },
      { id: "tokat", label: "Tokat", lat: 40.3167, lng: 36.5500 },
      { id: "sinop", label: "Sinop", lat: 42.0267, lng: 35.1550 },
      { id: "kastamonu", label: "Kastamonu", lat: 41.3887, lng: 33.7827 },
      { id: "zonguldak", label: "Zonguldak", lat: 41.4564, lng: 31.7987 },
      { id: "bolu", label: "Bolu", lat: 40.7395, lng: 31.6110 },
      { id: "duzce", label: "Düzce", lat: 40.8438, lng: 31.1565 },
      { id: "karabuk", label: "Karabük", lat: 41.2061, lng: 32.6204 },
      { id: "bartin", label: "Bartın", lat: 41.6344, lng: 32.3375 },
      { id: "artvin", label: "Artvin", lat: 41.1828, lng: 41.8183 },
      { id: "gumushane", label: "Gümüşhane", lat: 40.4603, lng: 39.4814 },
      { id: "bayburt", label: "Bayburt", lat: 40.2552, lng: 40.2249 },
    ],
  },
  {
    region: "Doğu Anadolu",
    locations: [
      { id: "erzurum", label: "Erzurum", lat: 39.9043, lng: 41.2679 },
      { id: "van", label: "Van", lat: 38.4891, lng: 43.4089 },
      { id: "agri", label: "Ağrı", lat: 39.7191, lng: 43.0503 },
      { id: "kars", label: "Kars", lat: 40.6013, lng: 43.0975 },
      { id: "malatya", label: "Malatya", lat: 38.3552, lng: 38.3095 },
      { id: "elazig", label: "Elazığ", lat: 38.6810, lng: 39.2264 },
      { id: "bingol", label: "Bingöl", lat: 38.8854, lng: 40.4983 },
      { id: "mus", label: "Muş", lat: 38.7432, lng: 41.5065 },
      { id: "bitlis", label: "Bitlis", lat: 38.4006, lng: 42.1095 },
      { id: "hakkari", label: "Hakkari", lat: 37.5744, lng: 43.7408 },
      { id: "igdir", label: "Iğdır", lat: 39.9167, lng: 44.0333 },
      { id: "ardahan", label: "Ardahan", lat: 41.1105, lng: 42.7022 },
      { id: "tunceli", label: "Tunceli", lat: 39.1079, lng: 39.5401 },
      { id: "erzincan", label: "Erzincan", lat: 39.7500, lng: 39.5000 },
    ],
  },
  {
    region: "Güneydoğu Anadolu",
    locations: [
      { id: "gaziantep", label: "Gaziantep", lat: 37.0662, lng: 37.3833 },
      { id: "sanliurfa", label: "Şanlıurfa", lat: 37.1591, lng: 38.7969 },
      { id: "diyarbakir", label: "Diyarbakır", lat: 37.9144, lng: 40.2306 },
      { id: "mardin", label: "Mardin", lat: 37.3212, lng: 40.7245 },
      { id: "batman", label: "Batman", lat: 37.8812, lng: 41.1351 },
      { id: "siirt", label: "Siirt", lat: 37.9333, lng: 41.9500 },
      { id: "sirnak", label: "Şırnak", lat: 37.5164, lng: 42.4611 },
      { id: "adiyaman", label: "Adıyaman", lat: 37.7648, lng: 38.2786 },
      { id: "kilis", label: "Kilis", lat: 36.7184, lng: 37.1212 },
    ],
  },
];

export const ALL_TURKISH_LOCATIONS: TurkishLocation[] = TURKISH_LOCATION_GROUPS.flatMap(
  (g) => g.locations
);

export function getLocationById(id: string): TurkishLocation | undefined {
  return ALL_TURKISH_LOCATIONS.find((loc) => loc.id === id);
}

export function getLocationLabel(id: string): string {
  return getLocationById(id)?.label ?? id;
}

/**
 * Verilen koordinata en yakın bilinen Türkiye lokasyonunu döndürür.
 * Bir durağın hangi şehirde olduğunu (ör. hava durumu etiketi) belirlemek için kullanılır.
 */
export function getNearestLocation(lat: number, lng: number): TurkishLocation {
  let nearest = ALL_TURKISH_LOCATIONS[0];
  let minDist = Number.POSITIVE_INFINITY;

  for (const loc of ALL_TURKISH_LOCATIONS) {
    const dLat = loc.lat - lat;
    const dLng = loc.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      nearest = loc;
    }
  }

  return nearest;
}
