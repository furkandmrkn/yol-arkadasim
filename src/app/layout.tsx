import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yol Arkadaşım — Türkiye Seyahat Planlayıcı",
  description:
    "Kişiselleştirilmiş gezi, konaklama ve rota planlama asistanı. Türkiye odaklı seyahat planınızı dakikalar içinde oluşturun.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
            <div className="container mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="font-bold text-lg text-primary">
                Yol Arkadaşım
              </a>
              <nav className="text-sm text-muted-foreground">
                <a href="/plan/new" className="hover:text-primary transition-colors">
                  Yeni Plan
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 text-center text-sm text-muted-foreground">
            <p>Powered by Google Maps · Türkiye odaklı seyahat planlayıcı MVP</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
