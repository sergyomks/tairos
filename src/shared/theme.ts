/**
 * Theme Manager — Manejo del tema (light/dark/system)
 * Persiste en localStorage y respeta la preferencia del SO
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "tairos-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "dark"; // default
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Resuelve el tema efectivo (considerando "system")
 */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return getSystemTheme();
  return theme;
}

/**
 * Aplica la clase "dark" al <html> según el tema resuelto
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Script inline para evitar el flash de tema incorrecto (FOUC).
 * Se ejecuta antes de que React hidrate.
 */
export const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('${STORAGE_KEY}');
      var theme = stored || 'dark';
      var resolved = theme;
      if (theme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;
