import { MapPin } from "lucide-react";
import { locations } from "@/lib/locations";
export function LocationSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="location-select">
      <MapPin size={17} aria-hidden="true" />
      <span className="sr-only">Select city</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
