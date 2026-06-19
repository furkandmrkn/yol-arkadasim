import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canModifyTrip, getAuthContext } from "@/lib/guest-trips";

type TripAccessRow = { userId: string | null; guestToken: string | null };

export async function getTripForModify(tripId: string): Promise<
  | { ok: true; trip: TripAccessRow }
  | { ok: false; response: NextResponse }
> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { userId: true, guestToken: true },
  });

  if (!trip) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 }),
    };
  }

  const ctx = await getAuthContext();
  if (!canModifyTrip(trip, ctx)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bu planı düzenleme yetkiniz yok" }, { status: 403 }),
    };
  }

  return { ok: true, trip };
}
