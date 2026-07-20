"use client";

import { useTheme } from "@/shared/components/ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";
import { useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();
  const [open, setOpen] = useState(false);

  const options: Array<{ value: typeof theme; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
    );
  }

  const current = options.find((o) => o.value === theme) ?? options[1];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-tairos-muted hover:text-tairos-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Cambiar tema"
      >
        <Icon className="w-5 h-5" />
      </button>

      {open && (
        <>
          {/* Backdrop transparente para cerrar al hacer click fuera */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-44 z-50 glass-card p-1.5 animate-fade-in">
            {options.map((opt) => {
              const OptIcon = opt.icon;
              const isActive = opt.value === theme;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTheme(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-tairos-accent/15 text-tairos-accent"
                      : "text-tairos-muted hover:text-tairos-text hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <OptIcon className="w-4 h-4" />
                  <span className="font-medium">{opt.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-tairos-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
