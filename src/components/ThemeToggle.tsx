import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("bm_theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("bm_theme", theme);
  }, [theme]);

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card/70 text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      title={dark ? "Use light theme" : "Use dark theme"}
    >
      {dark ? (
        <Sun className="h-[17px] w-[17px] transition-transform group-hover:rotate-12" />
      ) : (
        <Moon className="h-[17px] w-[17px] transition-transform group-hover:-rotate-12" />
      )}
    </button>
  );
}
