"use client";

import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { startOfDay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormField } from "@/components/wizard/FormField";

interface DatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  error?: string;
  disabled?: boolean;
}

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function isDateDisabled(date: Date, minDate?: Date, maxDate?: Date): boolean {
  const d = startOfDay(date);
  if (minDate && d < startOfDay(minDate)) return true;
  if (maxDate && d > startOfDay(maxDate)) return true;
  return false;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = "gg/aa/yyyy",
  minDate,
  maxDate,
  error,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  const displayValue = selected
    ? format(selected, "dd/MM/yyyy", { locale: tr })
    : null;

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const handleToday = () => {
    const today = startOfDay(new Date());
    if (isDateDisabled(today, minDate, maxDate)) return;
    onChange(format(today, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <FormField id={id} label={label} error={error}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full h-10 justify-start text-left font-normal bg-background",
              !displayValue && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{displayValue ?? placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={(date) => isDateDisabled(date, minDate, maxDate)}
            autoFocus
          />
          <div className="flex items-center justify-between border-t bg-popover px-3 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
              Temizle
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleToday}>
              Bugün
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
