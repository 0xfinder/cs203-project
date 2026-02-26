export type ThemeMode = "light" | "dark";

const THEME_KEY = "theme";

export function getStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark") {
      return raw;
    }
  } catch {}

  return "light";
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
