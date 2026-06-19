"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Bu planı silmek istediğinize emin misiniz?")) return;

    const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Plan silinemedi");
      return;
    }
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={handleDelete}
      aria-label="Planı sil"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
