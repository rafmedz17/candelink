"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const key = "candelink-theme";

function savedTheme() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  function sync() {
    const saved = savedTheme();
    document.documentElement.dataset.theme =
      saved === "dark" || saved === "light"
        ? saved
        : media.matches
          ? "dark"
          : "light";
    onChange();
  }
  function storage(event: StorageEvent) {
    if (event.key === key || event.key === null) sync();
  }
  media.addEventListener("change", sync);
  window.addEventListener("storage", storage);
  window.addEventListener("candelink-theme-change", onChange);
  return () => {
    media.removeEventListener("change", sync);
    window.removeEventListener("storage", storage);
    window.removeEventListener("candelink-theme-change", onChange);
  };
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Toggle dark mode"
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next =
          document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(key, next);
        } catch {
          /* Theme still works when storage is unavailable. */
        }
        window.dispatchEvent(new Event("candelink-theme-change"));
      }}
    >
      <Moon size={18} className="theme-moon" aria-hidden="true" />
      <Sun size={18} className="theme-sun" aria-hidden="true" />
    </button>
  );
}
