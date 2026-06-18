"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TURKISH_LOCATION_GROUPS } from "@/data/turkish-locations";
import { FormField } from "@/components/wizard/FormField";

interface CitySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (locationId: string) => void;
  placeholder?: string;
  excludeId?: string;
  error?: string;
}

export function CitySelect({
  id,
  label,
  value,
  onChange,
  placeholder = "Şehir seçin",
  excludeId,
  error,
}: CitySelectProps) {
  return (
    <FormField id={id} label={label} error={error}>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {TURKISH_LOCATION_GROUPS.map((group) => (
            <SelectGroup key={group.region}>
              <SelectLabel>{group.region}</SelectLabel>
              {group.locations
                .filter((loc) => loc.id !== excludeId)
                .map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
