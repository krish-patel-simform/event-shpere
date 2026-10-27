// Chart colours come from the design tokens in app/globals.css, so charts follow light/dark
// like the rest of the UI. Browser-only (it reads computed styles).

/** Token names in globals.css (without the leading --). */
const PALETTE_TOKENS = {
  brand: "brand",
  warning: "warning",
  success: "success",
  danger: "danger",
  muted: "muted",
  line: "line",
  foreground: "foreground",
  surface: "surface",
} as const;

export type ChartPalette = Record<keyof typeof PALETTE_TOKENS, string>;

/**
 * The tokens as real colours for the current theme. Reading `--brand` directly would return
 * its raw `light-dark(...)` text, which ECharts cannot use, so each token is set as `color` on
 * a hidden probe and the computed (resolved) colour is read back.
 */
export function resolveChartPalette(host: HTMLElement): ChartPalette {
  const probe = document.createElement("span");
  probe.hidden = true;
  host.appendChild(probe);

  const read = (token: string) => {
    probe.style.color = `var(--${token})`;
    return getComputedStyle(probe).color;
  };
  const palette = Object.fromEntries(
    Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, read(token)]),
  ) as ChartPalette;

  probe.remove();
  return palette;
}
