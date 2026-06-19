import { Prisma } from "@prisma/client";

export function formatApiError(error: unknown): { message: string; status: number; hint?: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2022") {
      return {
        status: 503,
        message: "Veritabanı şeması güncel değil",
        hint: 'Neon/Vercel için "npx prisma migrate deploy" veya prisma/migrations SQL dosyasını çalıştırın.',
      };
    }
    return {
      status: 500,
      message: "Veritabanı hatası",
      hint: process.env.NODE_ENV === "development" ? error.message : undefined,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      message: "Veritabanı modeli uyumsuz",
      hint:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Prisma client yeniden üretilmeli (prisma generate) ve migration uygulanmalı.",
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return { status: 500, message: "Bilinmeyen hata" };
}
