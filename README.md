# Yol Arkadaşım

Türkiye odaklı, rota bazlı seyahat planlama uygulaması. Başlangıç ve varış noktanı seç; gezi tercihlerini belirle; yapay zeka destekli önerilerle duraklarını ve konaklamanı planla; gün gün programını ve Google Maps rotanı tek tıkla al.

---

## Özellikler

### Plan modları
- **Seyahat planı (TRIP):** Şehirler arası rota (ör. Sakarya → Antalya), çok günlük program, konaklama adımı
- **Şehirde gez (CITY_DAY):** Tek şehir + tek gün; konaklama adımı yok, tempo odaklı günlük program

### Seyahat sihirbazı
- **Rota / şehir seçimi:** Türkiye şehir listesi, tarih ve grup bilgisi
- **Grup & tercihler:** Yetişkin/çocuk, bütçe, tempo, yeme-içme (içkili/içkisiz dahil)
- **Ulaşım:** Araç (`CAR`) veya toplu taşıma (`TRANSIT`); transit erişilebilirliğe göre filtreleme
- **Gezerek git:** Rota üzerindeki şehirlerde durak önerileri
- **Öneriler:** Kategori ve şehir bazlı gruplama, grup içi sayfalama, açılır/kapanır başlıklar
- **Konaklama:** Manuel arama; seçilen şehirlerde adres bazlı filtreleme (CITY_DAY hariç)

### Akıllı öneri motoru
- Google Places ile POI ve konaklama araması
- Kategori garantisi — seçilen her kategoriden en az bir öneri
- Skorlama: puan, yorum hacmi, rota uyumu, hava durumu, bütçe, yemek tercihleri, tempo
- **Yerel / turistik slider:** Bayesian popülerlik skoru ile doğru sıralama
- Kategori seçilmeden tempoya göre otomatik kategori önerisi
- OpenAI ile kısa “bu yüzden önerdim” metinleri (key yoksa şablon metin)

### Plan & rota
- Gün gün program: yolculuk süreleri, ziyaret süreleri, konaklama girişi
- Her gün için **o günün ilk durağının şehrine** göre hava durumu
- Google Maps deep link ile çok duraklı rota
- Paylaşılabilir plan sayfası (`/plan/[id]`)

### Hesap & misafir modu
- **Misafir:** Giriş yapmadan plan oluşturma; `guest_token` çerezi ile planlar cihaza bağlanır
- **Google ile giriş:** Auth.js + Google OAuth; planlar hesaba kaydedilir
- **Planlarım** (`/planlarim`): Giriş yapan kullanıcının geçmiş planları
- **Hesabım** (`/hesabim`): Profil ve plan sayısı
- **Otomatik bağlama:** Giriş sonrası aynı cihazdaki misafir planlar hesaba taşınır
- API düzenleme yetkisi: plan sahibi veya aynı misafir token

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Dil | TypeScript |
| UI | Tailwind CSS, Radix UI |
| Auth | Auth.js (NextAuth v5) + Google OAuth |
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

# PostgreSQL (Docker) — Google girişi için veritabanı zorunlu
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
| `NEXT_PUBLIC_APP_URL` | Deploy’da | Paylaşım linkleri |
| `AUTH_SECRET` | Giriş için | Auth.js oturum imzası (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | Giriş için | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Giriş için | Google OAuth client secret |
| `AUTH_URL` | Yerel/deploy | Site URL (yerelde `http://localhost:3000`) |

### Google OAuth kurulumu (giriş için)

1. [Google Cloud Console](https://console.cloud.google.com/) → proje seçin
2. **Google Auth Platform** → Branding (OAuth consent) → **External** → test kullanıcısı ekleyin
3. **Clients** → **Create client** → **Web application**
4. **Authorized redirect URIs:**
   - Yerel: `http://localhost:3000/api/auth/callback/google`
   - Canlı: `https://YOUR_DOMAIN/api/auth/callback/google`
5. Client ID ve Secret → `.env` dosyasına

> Google girişi çalışmıyorsa önce PostgreSQL’in ayakta olduğundan emin olun (`docker compose up -d`).

---

## Ücretsiz yayın (Vercel + Neon)

1. **Neon** — PostgreSQL: [neon.tech](https://neon.tech) → `DATABASE_URL`
2. **GitHub** — kodu push et
3. **Vercel** — repo import → env değişkenlerini ekle → Deploy
4. Neon’da tablolar: `npx prisma db push` veya `prisma/migrations/` SQL dosyalarını çalıştırın
5. Google Cloud → OAuth redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`
6. Google Maps key referrer: `https://*.vercel.app/*`

---

## Proje yapısı

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth (Google OAuth)
│   │   ├── trips/         # Plan CRUD + duraklar
│   │   ├── recommendations/
│   │   └── routes/
│   ├── plan/              # Plan oluşturma ve sonuç sayfası
│   ├── planlarim/         # Kullanıcı plan listesi
│   └── hesabim/           # Profil
├── components/
│   ├── auth/              # Giriş, misafir banner, plan silme
│   └── wizard/            # Seyahat sihirbazı
├── lib/
│   ├── scoring/           # Skorlama + popülerlik
│   ├── guest-trips.ts     # Misafir token & plan claim
│   └── trip-auth.ts       # Plan düzenleme yetkisi
├── auth.ts                # Auth.js yapılandırması
└── middleware.ts          # guest_token çerezi
prisma/
├── schema.prisma          # User, Trip, TripStop, Session...
└── migrations/
```

---

## API özeti

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/trips` | Yeni plan oluştur (misafir veya giriş yapmış kullanıcı) |
| `GET` | `/api/trips` | Giriş yapmış kullanıcının planları |
| `GET` | `/api/trips/[id]` | Plan detayı (paylaşım linki) |
| `PATCH` | `/api/trips/[id]` | Plan güncelle (yetki gerekli) |
| `DELETE` | `/api/trips/[id]` | Plan sil (hesap sahibi) |
| `PUT` | `/api/trips/[id]/stops` | Durakları kaydet (yetki gerekli) |
| `POST` | `/api/recommendations` | POI önerileri |
| `POST` | `/api/recommendations/lodging` | Konaklama önerileri |
| `POST` | `/api/routes` | Rota + timeline + günlük hava |
| `GET` | `/api/auth/*` | Auth.js (Google giriş/çıkış) |

---

## Komutlar

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run db:push      # Prisma şemasını veritabanına uygula
npm run db:studio    # Prisma Studio
npm run lint         # ESLint
```

---

## Notlar

- Google Places verisi için attribution zorunludur (uygulama içinde belirtilmiştir).
- OpenAI ve Google Maps kullanımı ücretlendirmeye tabi olabilir.
- Hava durumu değerlendirmesi gezi saatleri (08:00–20:00) üzerinden yapılır.
- Yerel geliştirmede Docker Desktop kapalıysa giriş ve plan kaydı çalışmaz.

---

## Lisans

Bu proje kişisel / demo amaçlıdır. Ticari kullanım için API sağlayıcılarının kullanım koşullarına uyulmalıdır.
