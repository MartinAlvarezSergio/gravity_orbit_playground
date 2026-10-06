import { useEffect, useState } from "react";

export type ColorTheme = "light" | "dark";

export const THEME_CHANGE_EVENT = "science-applets-theme-change";

const THEME_STORAGE_KEY = "science-applets-color-theme";

function readInitialTheme(): ColorTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted embeds.
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<ColorTheme>(() => {
    const initial = readInitialTheme();
    applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for this session.
    }
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: { theme }
      })
    );
  }, [theme]);

  return (
    <div className="theme-switcher" role="group" aria-label="Color theme">
      <span className="theme-switcher-label">Appearance</span>
      <button
        type="button"
        className={`theme-option${theme === "light" ? " is-active" : ""}`}
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
      >
        <span aria-hidden="true">☀</span> Light
      </button>
      <button
        type="button"
        className={`theme-option${theme === "dark" ? " is-active" : ""}`}
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        <span aria-hidden="true">☾</span> Dark
      </button>
    </div>
  );
}
