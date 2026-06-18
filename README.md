# Seyahat Navigatör — MVP

Türkiye odaklı web seyahat planlama uygulaması.

## Gereksinimler

- **Node.js 18.18+**
- API anahtarları opsiyonel (mock mod desteklenir):
  - Google Maps Platform
  - OpenWeatherMap
  - OpenAI

## Kurulum

```bash
cd travel-navigator
npm install

cp .env.example .env

# PostgreSQL başlat (Docker Desktop açık olmalı)
docker compose up -d

npm run db:push
npm run dev
```

Uygulama: http://localhost:3000

> Docker Desktop yüklü ve çalışır durumda olmalıdır. `docker compose up -d` komutu PostgreSQL'i başlatır.

## Özellikler

- 5 adımlı seyahat sihirbazı (rota, grup, gezerek git, öneriler, konaklama)
- Google Places API ile POI ve konaklama önerileri (mock fallback)
- Hava durumu entegrasyonu (OpenWeatherMap)
- LLM ile "bu yüzden önerdim" gerekçeleri (OpenAI)
- Çok duraklı rota + Google Maps deep link
- Gün gün timeline
- Paylaşılabilir plan linki

## Proje Yapısı

```
src/
├── app/              # Next.js App Router sayfaları ve API
├── components/       # UI, wizard, harita, kartlar
├── lib/              # Google, weather, scoring, LLM
└── types/            # Zod şemaları ve tipler
```

## API Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| POST | /api/trips | Yeni trip oluştur |
| GET | /api/trips/[id] | Trip detayı |
| PUT | /api/trips/[id]/stops | Durakları kaydet |
| POST | /api/recommendations | POI önerileri |
| POST | /api/recommendations/lodging | Konaklama önerileri |
| POST | /api/routes | Rota hesapla |
| GET | /api/weather | Hava durumu |

## Notlar

- API anahtarları olmadan uygulama **mock veri** ile çalışır (geliştirme/demo).
- Google Places verisi için attribution zorunludur (footer'da belirtilmiştir).
