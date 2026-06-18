"use client";

import { Loader2 } from "lucide-react";

interface SearchLoadingOverlayProps {
  title: string;
  lines: string[];
}

export function SearchLoadingOverlay({ title, lines }: SearchLoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Seçimlerinize göre arama yapılıyor, lütfen bekleyin…
        </p>
        {lines.length > 0 && (
          <ul className="space-y-1.5 text-sm text-muted-foreground border-t pt-4">
            {lines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
