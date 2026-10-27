/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { applyThemePreference } from "../../theme/theme";
import { EChart } from "../EChart";

// jsdom has no canvas: ECharts is replaced by a fake instance, and only the lifecycle is tested.
const mockChart = {
  setOption: jest.fn(),
  resize: jest.fn(),
  dispose: jest.fn(),
};
const mockInit = jest.fn<typeof mockChart, [HTMLElement]>(() => mockChart);
jest.mock("echarts/core", () => ({
  use: jest.fn(),
  init: (container: HTMLElement) => mockInit(container),
}));
jest.mock("echarts/charts", () => ({ BarChart: {} }));
jest.mock("echarts/components", () => ({
  AriaComponent: {},
  GridComponent: {},
  LegendComponent: {},
  TooltipComponent: {},
}));
jest.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));

// jsdom implements neither ResizeObserver nor matchMedia.
let resizeCallback: ResizeObserverCallback = () => {};
const disconnect = jest.fn();
beforeAll(() => {
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect = disconnect;
  };
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
});

beforeEach(() => {
  jest.clearAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

const getOption = jest.fn(() => ({ series: [] }));

describe("EChart", () => {
  it("creates one chart in its box and gives it the accessible description", () => {
    render(
      <EChart
        getOption={getOption}
        ariaLabel="Weekly sign-ups"
        className="h-48"
      />,
    );

    const box = screen.getByRole("img", { name: "Weekly sign-ups" });
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith(box);
    expect(mockChart.setOption).toHaveBeenCalledWith(
      {
        series: [],
        aria: { enabled: true, label: { description: "Weekly sign-ups" } },
      },
      { notMerge: true },
    );
  });

  it("builds the option again when the theme changes, so the colours follow it", () => {
    render(<EChart getOption={getOption} ariaLabel="Weekly sign-ups" />);
    expect(getOption).toHaveBeenCalledTimes(1);

    act(() => applyThemePreference("dark"));

    expect(getOption).toHaveBeenCalledTimes(2);
    expect(mockChart.setOption).toHaveBeenCalledTimes(2);
  });

  it("resizes with its box and is disposed on unmount (no leak)", () => {
    const { unmount } = render(
      <EChart getOption={getOption} ariaLabel="Weekly sign-ups" />,
    );

    resizeCallback([], {} as ResizeObserver);
    expect(mockChart.resize).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(mockChart.dispose).toHaveBeenCalledTimes(1);
  });
});
