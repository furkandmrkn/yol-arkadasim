import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth/SessionProvider";
import { AuthNav } from "@/components/auth/AuthNav";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Yol Arkadaşım — Türkiye Seyahat Planlayıcı",
  description:
    "Kişiselleştirilmiş gezi, konaklama ve rota planlama asistanı. Türkiye odaklı seyahat planınızı dakikalar içinde oluşturun.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans">
        <AuthSessionProvider>
          <div className="min-h-screen flex flex-col">
            <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
              <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
                <Link href="/" className="font-bold text-lg text-primary shrink-0">
                  Yol Arkadaşım
                </Link>
                <nav className="flex items-center gap-3 sm:gap-4 text-sm">
                  <Link href="/plan/new" className="text-muted-foreground hover:text-primary transition-colors">
                    Yeni Plan
                  </Link>
                  <AuthNav />
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t py-6 text-center text-sm text-muted-foreground">
              <p>Powered by Google Maps · Türkiye odaklı seyahat planlayıcı MVP</p>
            </footer>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
