import { Search } from "lucide-react";

/** A search field with its magnifier; the label is for screen readers (the placeholder is not one). */
export function SearchBox({
  label,
  placeholder = label,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-60 flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-field bg-surface py-2.5 pl-11 pr-3 placeholder:text-muted/70"
      />
    </div>
  );
}
