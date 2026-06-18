import Link from "next/link";
import { MapPin, Compass, CloudSun, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Compass,
    title: "Kişiselleştirilmiş Öneriler",
    description: "Grup profilinize, bütçenize ve ilgi alanlarınıza göre gezilecek yerler.",
  },
  {
    icon: CloudSun,
    title: "Hava Durumu Entegrasyonu",
    description: "Seyahat tarihinizdeki hava tahminine göre akıllı mekan önerileri.",
  },
  {
    icon: MapPin,
    title: "Kanıtlı Gerekçeler",
    description: "Her önerinin altında Google yorumları ve 'bu yüzden önerdim' açıklaması.",
  },
  {
    icon: Route,
    title: "Çok Duraklı Rota",
    description: "Seçtiğiniz duraklarla başlangıçtan varışa tam yol haritası.",
  },
];

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <section className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Türkiye&apos;yi{" "}
          <span className="text-primary">sizin için</span> planlayalım
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Nereden nereye, kaç kişi, hangi tarih — tüm detayları sorar, meşhur yerleri ve
          yemek önerilerini çıkarır, hava durumuna göre filtreler ve rotanızı haritada
          birleştirir.
        </p>
        <Button asChild size="lg" className="text-base px-8">
          <Link href="/plan/new">Seyahat Planlamaya Başla</Link>
        </Button>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {features.map((feature) => (
          <Card key={feature.title} className="border-0 shadow-md">
            <CardHeader>
              <feature.icon className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="bg-accent/50 rounded-2xl p-8 md:p-12 text-center">
        <h2 className="text-2xl font-semibold mb-3">Gezerek git modu</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          Az gezmeli, orta veya çok gezmeli — müze, mağara, doğa, plaj gibi kategorileri
          seçin. Yerel mi turistik mi istediğinizi belirleyin, size özel durakları seçin.
        </p>
        <Button asChild variant="outline">
          <Link href="/plan/new">Hemen Dene</Link>
        </Button>
      </section>
    </div>
  );
}
