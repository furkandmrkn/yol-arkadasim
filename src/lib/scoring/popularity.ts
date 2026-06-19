/** Bayesian ortalama + log yorum hacmi — az yorumlu yüksek puan tuzağını azaltır. */
export function computePopularityScore(rating?: number, reviewCount?: number): number {
  const r = rating ?? 3.5;
  const n = Math.max(0, reviewCount ?? 0);
  const priorWeight = 40;
  const priorMean = 3.7;
  const bayesian = (priorWeight * priorMean + n * r) / (priorWeight + n);
  const quality = (bayesian - 3) * 18;
  const volume = n > 0 ? Math.min(28, Math.log10(n + 1) * 7.5) : -6;
  return quality + volume;
}

export function popularityRankKey(item: { rating?: number; reviewCount?: number }): number {
  const r = item.rating ?? 0;
  const n = item.reviewCount ?? 0;
  return r * Math.log10(n + 10);
}

export function compareRecommendationRank(
  a: { score: number; rating?: number; reviewCount?: number },
  b: { score: number; rating?: number; reviewCount?: number }
): number {
  if (b.score !== a.score) return b.score - a.score;
  return popularityRankKey(b) - popularityRankKey(a);
}

/** 0 = yerel, 100 = turistik */
export function scoreLocalVsTouristFit(
  reviewCount: number | undefined,
  localVsTourist: number
): number {
  const n = reviewCount ?? 0;

  if (localVsTourist >= 67) {
    if (n >= 15000) return 20;
    if (n >= 5000) return 14;
    if (n >= 1500) return 8;
    if (n >= 400) return 2;
    return -10;
  }

  if (localVsTourist <= 33) {
    if (n >= 15000) return -14;
    if (n >= 5000) return -8;
    if (n <= 800) return 12;
    if (n <= 2500) return 6;
    return 0;
  }

  return 0;
}
