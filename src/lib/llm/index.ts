import OpenAI from "openai";
import type { PoiRecommendation, TripWizardData } from "@/types/trip";
import { getLocalVsTouristDescription } from "@/lib/wizard-labels";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function generateRecommendationReasons(
  recommendations: PoiRecommendation[],
  wizard: TripWizardData
): Promise<PoiRecommendation[]> {
  if (!openai || recommendations.length === 0) {
    return recommendations.map((r) => ({
      ...r,
      reason: buildFallbackReason(r, wizard),
    }));
  }

  try {
    const preferenceNote = getLocalVsTouristDescription(wizard.localVsTourist);

    const prompt = `Sen Türkiye seyahat planlama asistanısın. Aşağıdaki yerler için kısa "neden önerildi" cümleleri yaz.
SADECE verilen puan, yorum sayısı ve review snippet bilgisini kullan; uydurma detay yazma.
Tercih: ${preferenceNote}
Turistik tercih varsa çok yorumlu ve yüksek puanlı yerlerin bilinirliğini vurgula; yerel tercih varsa sakin/az bilinen yönlerini vurgula.
Her yer için 1-2 cümle Türkçe.
Grup: ${wizard.adults} yetişkin, ${wizard.childrenAges.length} çocuk.
JSON array döndür: [{ "placeId": "...", "reason": "..." }]

Yerler:
${recommendations
  .map(
    (r) =>
      `- placeId=${r.placeId} | ${r.name} (${r.category}) | ${r.rating ?? "?"} puan | ${r.reviewCount ?? 0} yorum | snippet: "${r.evidence[0]?.snippet?.slice(0, 120) ?? ""}"`
  )
  .join("\n")}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No content");

    const parsed = JSON.parse(content) as {
      recommendations?: { placeId: string; reason: string }[];
      items?: { placeId: string; reason: string }[];
    };

    const reasons = parsed.recommendations ?? parsed.items ?? (Array.isArray(parsed) ? parsed : []);

    return recommendations.map((r) => {
      const found = reasons.find((item) => item.placeId === r.placeId);
      return {
        ...r,
        reason: found?.reason ?? buildFallbackReason(r, wizard),
      };
    });
  } catch {
    return recommendations.map((r) => ({
      ...r,
      reason: buildFallbackReason(r, wizard),
    }));
  }
}

function buildFallbackReason(r: PoiRecommendation, wizard: TripWizardData): string {
  const parts: string[] = [];
  const reviews = r.reviewCount ?? 0;

  if (r.rating && r.rating >= 4.5) {
    if (reviews >= 5000 && wizard.localVsTourist >= 67) {
      parts.push(
        `${r.rating} puan ve ${reviews.toLocaleString("tr-TR")} yorumla bölgenin en bilinen duraklarından`
      );
    } else if (reviews >= 1000) {
      parts.push(`${r.rating} puan ve ${reviews.toLocaleString("tr-TR")} yorumla güvenilir bir seçenek`);
    } else {
      parts.push(`${r.rating} puanlı, henüz az bilinen bir durak`);
    }
  }

  if (wizard.childrenAges.length > 0) {
    parts.push("aile gezileri için uygun");
  }

  if (r.weatherTag) {
    parts.push(r.weatherTag.toLowerCase());
  }

  if (r.evidence[0]?.snippet) {
    parts.push(`Ziyaretçi yorumu: "${r.evidence[0].snippet.slice(0, 80)}..."`);
  }

  return parts.length > 0
    ? parts.join(". ") + "."
    : "Rota üzerinde popüler bir durak olarak önerildi.";
}
