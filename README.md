# Yol Arkadaşım

Türkiye odaklı, rota bazlı seyahat planlama uygulaması. Başlangıç ve varış noktanı seç; gezi tercihlerini belirle; yapay zeka destekli önerilerle duraklarını ve konaklamanı planla; gün gün programını ve Google Maps rotanı tek tıkla al.

---

## Özellikler

### Seyahat sihirbazı (5 adım)
- **Rota:** Türkiye şehirleri arası plan (ör. Sakarya → Antalya)
- **Grup & tercihler:** Yetişkin/çocuk, bütçe, tempo, yeme-içme (içkili/içkisiz dahil)
- **Gezerek git:** Rota üzerindeki şehirlerde (Eskişehir, Isparta, Antalya vb.) durak önerileri
- **Öneriler:** Kategori ve şehir bazlı gruplama, grup içi sayfalama, açılır/kapanır başlıklar
- **Konaklama:** Manuel arama; seçilen şehirlerde adres bazlı filtreleme

### Akıllı öneri motoru
- Google Places ile POI ve konaklama araması
- Kategori garantisi (Müze, Doğa, Yeme-İçme vb. — her seçilen kategoriden en az bir öneri)
- Skorlama: puan, yorum, rota uyumu, hava durumu, tercihler
- OpenAI ile kısa “bu yüzden önerdim” metinleri (key yoksa otomatik fallback)

### Plan & rota
- Gün gün program: yolculuk süreleri, ziyaret süreleri, konaklama girişi
- Her gün için **o günün ilk durağının şehrine** göre hava durumu
- Google Maps deep link ile çok duraklı rota
- Paylaşılabilir plan sayfası

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Dil | TypeScript |
| UI | Tailwind CSS, Radix UI |
| Veritabanı | PostgreSQL + Prisma |
| Harita | Google Maps Platform |
| Hava | OpenWeatherMap |
| AI | OpenAI (gpt-4o-mini) |

---

## Hızlı başlangıç (yerel)

### Gereksinimler
- Node.js **18.18+**
- Docker Desktop (yerel PostgreSQL için) veya Neon bağlantı dizesi

### Kurulum

```bash
git clone https://github.com/furkandmrkn/yol-arkadasim.git
cd yol-arkadasim
npm install

cp .env.example .env
# .env dosyasına API anahtarlarını ekle

# PostgreSQL (Docker)
docker compose up -d

npm run db:push
npm run dev
```

Tarayıcı: **http://localhost:3000**

### Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `DATABASE_URL` | Evet | PostgreSQL bağlantı dizesi |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Harita için | Google Maps (client) |
| `GOOGLE_MAPS_API_KEY` | Öneriler için | Google Places / Directions (server) |
| `OPENWEATHER_API_KEY` | Hava için | OpenWeatherMap |
| `OPENAI_API_KEY` | Hayır | Öneri gerekçeleri (yoksa şablon metin) |
| `NEXT_PUBLIC_APP_URL` | Deploy’da | Paylaşım linkleri (ör. `https://xxx.vercel.app`) |

API anahtarları olmadan uygulama **mock veri** ile çalışır (geliştirme/demo).

---

## Ücretsiz yayın (Vercel + Neon)

1. **Neon** — PostgreSQL: [neon.tech](https://neon.tech) → connection string → `DATABASE_URL`
2. **GitHub** — kodu push et
3. **Vercel** — [vercel.com](https://vercel.com) → Import repo → env değişkenlerini ekle → Deploy
4. Neon’da tablolar: `npx prisma db push` (Neon URL ile)
5. Google Maps key referrer kısıtına Vercel domain’ini ekle: `https://*.vercel.app/*`

---

## Proje yapısı

```
src/
├── app/                 # Sayfalar ve API route’ları
│   ├── api/             # trips, recommendations, routes, weather
│   └── plan/            # Plan oluşturma ve sonuç sayfası
├── components/          # Wizard, harita, kartlar, UI
├── data/                # Türkiye şehir verisi
├── lib/                 # Google, weather, scoring, LLM, route-utils
└── types/               # Zod şemaları ve TypeScript tipleri
prisma/
└── schema.prisma        # Trip & TripStop modelleri
```

---

## API özeti

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/trips` | Yeni plan oluştur |
| `GET` | `/api/trips/[id]` | Plan detayı |
| `PATCH` | `/api/trips/[id]` | Plan güncelle |
| `PUT` | `/api/trips/[id]/stops` | Durakları kaydet |
| `POST` | `/api/recommendations` | POI önerileri (grouped / group modları) |
| `POST` | `/api/recommendations/lodging` | Konaklama önerileri |
| `POST` | `/api/routes` | Rota + timeline + günlük hava durumu |
| `GET` | `/api/weather` | Hava durumu |

---

## Komutlar

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run db:push      # Prisma şemasını veritabanına uygula
npm run db:studio    # Prisma Studio (veritabanı GUI)
npm run lint         # ESLint
```

---

## Notlar

- Google Places verisi için attribution zorunludur (uygulama içinde belirtilmiştir).
- OpenAI ve Google Maps kullanımı ücretlendirmeye tabi olabilir; ücretsiz kotalar sınırlıdır.
- Hava durumu değerlendirmesi gezi saatleri (08:00–20:00) üzerinden yapılır.

---

## Lisans

Bu proje kişisel / demo amaçlıdır. Ticari kullanım için API sağlayıcılarının kullanım koşullarına uyulmalıdır.
