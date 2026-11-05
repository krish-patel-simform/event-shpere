import type { ReactNode } from "react";
import { Button, SourceBadge, type DataSource } from "@/src/core/ui";
import type {
  PublicEventPrice,
  PublicEventWhen,
} from "../schemas/event-public.schemas";

export type PriceFilter = PublicEventPrice | "all";

const WHEN_OPTIONS: readonly { value: PublicEventWhen; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past events" },
];

const PRICE_OPTIONS: readonly { value: PriceFilter; label: string }[] = [
  { value: "all", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

/** One titled group of options, with the badge that says whether the API backs it. */
function FilterGroup({
  title,
  source,
  children,
}: {
  title: string;
  source: DataSource;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-2 flex w-full items-center justify-between gap-2 text-sm font-semibold">
        {title}
        <SourceBadge source={source} />
      </legend>
      {children}
    </fieldset>
  );
}

const optionClass = "flex min-h-8 items-center gap-2.5 text-sm";

/**
 * The filter panel beside the grid. Controlled: the page owns the values.
 * When and Price are asked of the server (Live). City and Availability are in the design but the
 * API has no such filter yet, so they are shown switched off (Static).
 */
export function PublicEventFilters({
  when,
  price,
  onWhenChange,
  onPriceChange,
  onClear,
  canClear,
}: {
  when: PublicEventWhen;
  price: PriceFilter;
  onWhenChange: (when: PublicEventWhen) => void;
  onPriceChange: (price: PriceFilter) => void;
  onClear: () => void;
  /** Something differs from the defaults, so "Clear all" does something. */
  canClear: boolean;
}) {
  return (
    <aside
      aria-label="Filters"
      className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Filters</h2>
        <Button variant="secondary" onClick={onClear} disabled={!canClear}>
          Clear all
        </Button>
      </div>

      <FilterGroup title="Date" source="live">
        {WHEN_OPTIONS.map((option) => (
          <label key={option.value} className={optionClass}>
            <input
              type="radio"
              name="when"
              checked={when === option.value}
              onChange={() => onWhenChange(option.value)}
              className="size-4"
            />
            {option.label}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Price" source="live">
        {PRICE_OPTIONS.map((option) => (
          <label key={option.value} className={optionClass}>
            <input
              type="radio"
              name="price"
              checked={price === option.value}
              onChange={() => onPriceChange(option.value)}
              className="size-4"
            />
            {option.label}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="City" source="static">
        {["Pune", "Bengaluru", "Mumbai"].map((city) => (
          <label key={city} className={`${optionClass} text-muted`}>
            <input type="checkbox" disabled className="size-4" />
            {city}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup title="Availability" source="static">
        <label className={`${optionClass} text-muted`}>
          <input type="checkbox" disabled className="size-4" />
          Hide sold-out events
        </label>
      </FilterGroup>
    </aside>
  );
}
