import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GUEST_COOKIE_NAME } from "@/lib/guest-trips";

export function middleware(request: NextRequest) {
  // OAuth PKCE çerezlerini bozmamak için auth route'larına dokunma
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  if (!request.cookies.get(GUEST_COOKIE_NAME)?.value) {
    response.cookies.set(GUEST_COOKIE_NAME, crypto.randomUUID(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
