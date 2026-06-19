"use client";

import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SignInPromptProps {
  title: string;
  description: string;
  callbackUrl?: string;
}

export function SignInPrompt({ title, description, callbackUrl = "/planlarim" }: SignInPromptProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" onClick={() => signIn("google", { callbackUrl })}>
          <LogIn className="h-4 w-4 mr-2" />
          Google ile giriş yap
        </Button>
        <p className="text-xs text-muted-foreground">
          Giriş yapmadan da plan oluşturabilirsiniz. Misafir planlar tarayıcı çerezine bağlıdır;
          giriş yapınca hesabınıza taşınır.
        </p>
      </CardContent>
    </Card>
  );
}
