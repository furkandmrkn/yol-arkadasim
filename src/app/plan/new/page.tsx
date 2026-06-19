import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TripWizard } from "@/components/wizard/TripWizard";

function WizardFallback() {
  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Plan sihirbazı yükleniyor...</p>
    </div>
  );
}

export default function NewPlanPage() {
  return (
    <Suspense fallback={<WizardFallback />}>
      <TripWizard />
    </Suspense>
  );
}
