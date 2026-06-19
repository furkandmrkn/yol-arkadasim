"use client";

import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GuestSaveBannerProps {
  className?: string;
}

/** Misafir kullanıcıya: giriş yapınca bu cihazdaki planlar hesaba bağlanır. */
export function GuestSaveBanner({ className }: GuestSaveBannerProps) {
  return (
    <Card className={`border-dashed ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Planını kaybetme</CardTitle>
        <CardDescription>
          Google ile giriş yaparsanız bu cihazda oluşturduğunuz planlar hesabınıza eklenir ve
          &quot;Planlarım&quot; sayfasından tekrar ulaşabilirsiniz. Giriş yapmadan da devam
          edebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => signIn("google", { callbackUrl: window.location.pathname })}
        >
          <LogIn className="h-4 w-4 mr-1" />
          Google ile giriş yap
        </Button>
      </CardContent>
    </Card>
  );
}
