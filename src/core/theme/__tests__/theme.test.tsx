/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "../../ui";
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
} from "../theme";

const root = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  root.removeAttribute("data-theme");
});

describe("theme preference", () => {
  it("is 'system' when nothing is saved, or when the saved value is unknown", () => {
    expect(readThemePreference()).toBe("system");
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(readThemePreference()).toBe("system");
  });

  it("saves an explicit choice and puts it on <html>", () => {
    applyThemePreference("dark");
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readThemePreference()).toBe("dark");
  });

  it("'system' removes the attribute and the saved value, so the OS decides again", () => {
    applyThemePreference("light");
    applyThemePreference("system");
    expect(root).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe("THEME_INIT_SCRIPT (runs before first paint)", () => {
  const run = () => new Function(THEME_INIT_SCRIPT)();

  it("applies a saved light or dark choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(root).toHaveAttribute("data-theme", "dark");
  });

  it("does nothing for no choice or a bad value", () => {
    run();
    window.localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    run();
    expect(root).not.toHaveAttribute("data-theme");
  });

  it("does not throw when storage is blocked", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    spy.mockRestore();
  });
});

describe("ThemeToggle", () => {
  it("shows the current choice as pressed and switches on click", async () => {
    render(<ThemeToggle />);
    const light = screen.getByRole("button", { name: "Light theme" });
    const dark = screen.getByRole("button", { name: "Dark theme" });
    const system = screen.getByRole("button", { name: "System theme" });

    expect(system).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(dark);
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(system).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(light);
    expect(root).toHaveAttribute("data-theme", "light");
    expect(light).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(system);
    expect(root).not.toHaveAttribute("data-theme");
    expect(system).toHaveAttribute("aria-pressed", "true");
  });

  it("two switches on the same page stay in step", async () => {
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Dark theme" })[0]);

    for (const button of screen.getAllByRole("button", { name: "Dark theme" })) {
      expect(button).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("follows a change made in another tab", () => {
    render(<ThemeToggle />);
    act(() => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
  });
});
