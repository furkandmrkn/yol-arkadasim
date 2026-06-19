import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const GUEST_COOKIE_NAME = "guest_token";

export async function getGuestToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(GUEST_COOKIE_NAME)?.value;
}

/** Misafirken oluşturulan planları giriş yapan kullanıcıya bağlar. */
export async function claimGuestTrips(userId: string): Promise<number> {
  const guestToken = await getGuestToken();
  if (!guestToken) return 0;

  const result = await prisma.trip.updateMany({
    where: { guestToken, userId: null },
    data: { userId, guestToken: null },
  });

  return result.count;
}

export async function getAuthContext(): Promise<{
  userId: string | null;
  guestToken: string | null;
}> {
  const { auth } = await import("@/auth");
  const session = await auth();
  const guestToken = await getGuestToken();
  return {
    userId: session?.user?.id ?? null,
    guestToken: guestToken ?? null,
  };
}

export function canModifyTrip(
  trip: { userId: string | null; guestToken: string | null },
  ctx: { userId: string | null; guestToken: string | null }
): boolean {
  if (trip.userId) {
    return trip.userId === ctx.userId;
  }
  if (trip.guestToken && ctx.guestToken) {
    return trip.guestToken === ctx.guestToken;
  }
  // Eski kayıtlar (guestToken yok): misafir düzenlemeye devam edebilsin
  return !trip.userId;
}
