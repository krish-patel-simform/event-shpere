---
name: charts-echarts
description: Apache ECharts in EventSphere: client-only loading with next/dynamic, tree-shaken imports, typed option builders for KPI, line, bar, pie and donut charts, interactivity, resize handling, theming, and empty/loading/error states for poll results and the organizer dashboard. Use when building any chart, poll results visualization, or dashboard widget.
---

# Charts with Apache ECharts

Serves: POLL-5, POLL-2, DASH-1, DASH-2, DASH-3, DASH-4, DASH-5, DASH-6, DASH-7, DASH-8.
Related: `database-drizzle` (aggregations), `api-design` (analytics endpoints), `ui-implementation` (states), `state-management` (dashboard filters), `component-development`.

> Verify import paths against the installed `echarts` version docs (`echarts/core`, `echarts/charts`, `echarts/components`, `echarts/renderers`). Say so if unsure.

## Purpose
Render interactive, accessible, lightweight charts that never block server rendering and are driven by typed data from the API.

## Chart ↔ requirement map
| Widget | Type | Data endpoint | Req |
| --- | --- | --- | --- |
| Total registrations | **KPI card** (plain HTML/Tailwind, not ECharts) with delta vs previous period | `/api/organizer/analytics/summary` | DASH-1 |
| Ticket sales over time | **Line** | `/ticket-sales?from&to` | DASH-2 |
| Event attendance | **Bar** | `/attendance` | DASH-3 |
| Poll participation | **Pie** | `/poll-participation` | DASH-4 |
| Session popularity | **Donut** (pie with inner radius) | `/session-popularity` | DASH-5 |
| Poll results | **Bar / Pie / Donut** (user can switch) | `/api/polls/[id]/results` | POLL-5 |

## MUST
- **Client-only**: charts live in `"use client"` components loaded with `next/dynamic(() => import("./EChart"), { ssr: false, loading: () => <ChartSkeleton/> })` (the `ssr: false` option must be used from a Client Component). One generic `EChart` wrapper (`core/ui` or `features/dashboard/components`) owns init/dispose/resize.
- **Tree-shake**: `import * as echarts from "echarts/core"; import { BarChart, LineChart, PieChart } from "echarts/charts"; import { GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TitleComponent, AriaComponent } from "echarts/components"; import { CanvasRenderer } from "echarts/renderers"; echarts.use([...])`. Never `import * as echarts from "echarts"` (huge bundle).
- `EChart` wrapper: `useRef` container → `echarts.init(el, theme)` in `useEffect`; `setOption(option, { notMerge: false })` when option changes; `ResizeObserver` → `chart.resize()`; `chart.dispose()` on unmount; `aria: { enabled: true }`; forwards `onEvents` (`click` on a bar → drill-down/filter, DASH-7).
- **Typed option builders** in `features/dashboard/utils/chartOptions.ts`: `buildLineOption(points: TicketSalesPoint[]): EChartsOption`, `buildBarOption`, `buildPieOption(data, { donut })` (donut: `radius: ["45%","70%"]`). Pure functions → unit-testable (TEST-1). Use `import type { EChartsOption } from "echarts"` and a minimal `ComposeOption<...>` type if needed.
- Data comes through RTK Query hooks parsed by Zod (`api-integration`); builders receive typed DTOs. Numbers/dates are already normalized by the API (ISO days, integer cents → format in tooltip).
- **Interactivity** (DASH-7): tooltips, legend toggle, `dataZoom` on the line chart, click-to-filter, hover highlight (`emphasis`), animation on update. **Date filtering** (DASH-6): date-range control writes `dashboardSlice.dateRange` (and the URL); queries re-run with `from/to`. **Refresh** (DASH-8): button calls `refetch` (+ optional polling interval, pause when tab hidden).
- Every chart shows **loading skeleton, empty state ("No sales in this period"), error state with retry**, and a text alternative (visually hidden table or `aria-label` summary).
- Theming: one `eventSphereTheme` (colors from design tokens, light/dark) registered with `echarts.registerTheme`; consistent palette across charts; sufficient contrast; never color alone (labels/percentages).
- Poll results (POLL-5): chart type switcher (bar/pie/donut) for the same data; percentages and counts; updates when `liveResults` change (`polls` slice or refetch).

## MUST NOT
- No ECharts on the server (it needs the DOM) and no SSR hydration of chart markup.
- No full-library import; no chart options built inline in JSX; no mutating option objects between renders.
- No fetching inside the chart component (container fetches, chart renders).
- No unbounded data (aggregate in SQL; limit series points, e.g. ≤ 366 days).

## Procedure: add a widget
1. Define the analytics endpoint + response Zod schema (SQL aggregation, organizer-scoped). 2. RTK Query hook. 3. Option builder + unit test. 4. `<Widget>` container with states + dynamic `EChart`. 5. Wire date filter + refresh. 6. Component test: states + builder output; E2E smoke.

## Example: session popularity donut (DASH-5)
```ts
export function buildPieOption(data: { name: string; value: number }[], opts: { donut?: boolean } = {}): EChartsOption {
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0 },
    series: [{ type: "pie", radius: opts.donut ? ["45%", "70%"] : "70%", data,
      label: { formatter: "{b}\n{d}%" }, emphasis: { scale: true } }],
  };
}
```
The widget: `const { data, isLoading, error, refetch } = useSessionPopularityQuery(range)` → skeleton / `<ErrorState onRetry={refetch}/>` / `<EmptyState/>` / `<EChart option={buildPieOption(data.items, { donut: true })}/>`.

## Common mistakes
- `ssr: false` used inside a Server Component (build error).
- Forgetting `dispose()` (memory leak) or `resize()` (chart overflows on mobile).
- Passing a new option object each render without memoizing → flicker.
- Returning Postgres `bigint` counts as strings and charting NaN.
- Showing a blank chart instead of an empty state.

## Final checklist
- [ ] Client-only, dynamic import, tree-shaken `echarts.use`.
- [ ] Option builders typed + unit-tested; donut = pie with inner radius.
- [ ] Loading/empty/error + text alternative present.
- [ ] Date filter and refresh wired; interactions work; resizes on mobile.
- [ ] Data aggregated in SQL and scoped to the organizer's events.
