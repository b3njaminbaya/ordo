import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

function resolveTheme(theme) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyToDOM(theme) {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem("theme") || "system"
  );

  const setTheme = (next) => {
    setThemeState(next);
    if (next === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", next);
    }
    applyToDOM(next);
  };

  // Apply on mount (handles SSR/hydration edge cases)
  useEffect(() => { applyToDOM(theme); }, [theme]);

  // Track system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDOM("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const resolvedTheme = resolveTheme(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
