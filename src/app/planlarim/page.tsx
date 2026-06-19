import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTr } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteTripButton } from "@/components/auth/DeleteTripButton";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import { MapPin, Plus, Pencil } from "lucide-react";

export const metadata = {
  title: "Planlarım — Yol Arkadaşım",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PLANNED: "Hazır",
  COMPLETED: "Tamamlandı",
};

export default async function PlanlarimPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <SignInPrompt
          title="Planlarınızı görüntüleyin"
          description="Google ile giriş yaptığınızda bu cihazda oluşturduğunuz misafir planlar otomatik olarak hesabınıza eklenir."
          callbackUrl="/planlarim"
        />
      </div>
    );
  }

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { stops: true } } },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Planlarım</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {session.user.name ?? session.user.email} — {trips.length} plan
          </p>
        </div>
        <Button asChild>
          <Link href="/plan/new">
            <Plus className="h-4 w-4 mr-1" />
            Yeni plan
          </Link>
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Henüz kayıtlı plan yok</CardTitle>
            <CardDescription>
              Yeni bir plan oluşturun veya giriş yapmadan oluşturduğunuz planlar bu hesaba
              bağlanmış olabilir — sayfayı yenileyin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/plan/new">Plan oluştur</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => {
            const cityDay = trip.planType === "CITY_DAY";
            const title = cityDay
              ? `${trip.destination}'da gün planı`
              : `${trip.origin} → ${trip.destination}`;

            return (
              <li key={trip.id}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={
                          trip.status === "DRAFT"
                            ? `/plan/new?tripId=${trip.id}`
                            : `/plan/${trip.id}`
                        }
                        className="block group"
                      >
                        <p className="font-medium group-hover:text-primary transition-colors truncate">
                          {title}
                        </p>
                        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span>
                            {cityDay
                              ? formatDateTr(trip.startDate.toISOString().split("T")[0])
                              : `${formatDateTr(trip.startDate.toISOString().split("T")[0])} — ${formatDateTr(trip.endDate.toISOString().split("T")[0])}`}
                          </span>
                          {!cityDay && (
                            <>
                              <span>·</span>
                              <span>{trip.days} gün</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {trip._count.stops} durak
                          </span>
                        </p>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={trip.status === "PLANNED" ? "default" : "secondary"}>
                        {statusLabels[trip.status] ?? trip.status}
                      </Badge>
                      {trip.status === "DRAFT" && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/plan/new?tripId=${trip.id}`}>
                            <Pencil className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Devam et</span>
                          </Link>
                        </Button>
                      )}
                      <DeleteTripButton tripId={trip.id} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
