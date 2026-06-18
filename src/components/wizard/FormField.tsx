import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ id, label, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id} className="block">
        {label}
      </Label>
      <div className="w-full">{children}</div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
