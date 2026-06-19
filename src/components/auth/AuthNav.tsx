"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { LogIn, LogOut, Map, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/planlarim"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <Map className="h-4 w-4" />
          Planlarım
        </Link>
        <Link
          href="/hesabim"
          className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <User className="h-4 w-4" />
          Hesabım
        </Link>
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-8 w-8 rounded-full border"
          />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-muted-foreground"
        >
          <LogOut className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Çıkış</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => signIn("google", { callbackUrl: "/planlarim" })}
    >
      <LogIn className="h-4 w-4 mr-1" />
      Google ile giriş
    </Button>
  );
}
