import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "@/components/auth/SignInPrompt";

export const metadata = {
  title: "Hesabım — Yol Arkadaşım",
};

export default async function HesabimPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <SignInPrompt
          title="Hesabınız"
          description="Profil bilgilerinizi görmek ve planlarınızı yönetmek için Google ile giriş yapın."
          callbackUrl="/hesabim"
        />
      </div>
    );
  }

  const tripCount = await prisma.trip.count({ where: { userId: session.user.id } });

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Hesabım</h1>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-16 w-16 rounded-full border"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
              {(session.user.name ?? session.user.email ?? "?")[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <CardTitle>{session.user.name ?? "Kullanıcı"}</CardTitle>
            <CardDescription>{session.user.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kayıtlı plan sayısı: <strong className="text-foreground">{tripCount}</strong>
          </p>
          <Button asChild variant="outline">
            <Link href="/planlarim">Planlarıma git</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
