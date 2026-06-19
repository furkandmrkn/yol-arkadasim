import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPrismaTripDataFromWizard, tripWizardSchema } from "@/lib/trip-payload";
import { formatApiError } from "@/lib/api-errors";
import { getAuthContext } from "@/lib/guest-trips";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = tripWizardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const ctx = await getAuthContext();
    const tripFields = await buildPrismaTripDataFromWizard(data);

    const trip = await prisma.trip.create({
      data: {
        ...tripFields,
        userId: ctx.userId,
        guestToken: ctx.userId ? null : ctx.guestToken,
      },
    });

    return NextResponse.json({ id: trip.id, trip });
  } catch (error) {
    console.error("POST /api/trips error:", error);
    const formatted = formatApiError(error);
    return NextResponse.json(
      {
        error: formatted.message,
        hint: formatted.hint,
        code:
          error instanceof Error && "code" in error
            ? String((error as { code?: string }).code)
            : undefined,
      },
      { status: formatted.status }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ trips: [] });
    }

    const trips = await prisma.trip.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        planType: true,
        origin: true,
        destination: true,
        startDate: true,
        endDate: true,
        days: true,
        status: true,
        createdAt: true,
        _count: { select: { stops: true } },
      },
    });
    return NextResponse.json({ trips });
  } catch (error) {
    console.error("GET /api/trips error:", error);
    return NextResponse.json({ error: "Trips alınamadı" }, { status: 500 });
  }
}
