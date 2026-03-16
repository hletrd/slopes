"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "@/lib/types";

const STORAGE_KEY = "webcamSettings";

function getDefaultSettings(): AppSettings {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  return {
    autoplay: !isMobile,
    darkMode: true,
    quadViewOpen: false,
  };
}

function loadSettings(): AppSettings {
  const defaults = getDefaultSettings();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const applyTheme = useCallback((darkMode: boolean) => {
    if (typeof document === "undefined") return;
    if (darkMode) {
      document.body.classList.remove("light-mode");
      document.body.setAttribute("data-theme", "dark");
    } else {
      document.body.classList.add("light-mode");
      document.body.setAttribute("data-theme", "light");
    }
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        if (partial.darkMode !== undefined) {
          applyTheme(partial.darkMode);
        }
        return next;
      });
    },
    [applyTheme]
  );

  // Apply theme on mount and whenever darkMode changes
  useEffect(() => {
    applyTheme(settings.darkMode);
  }, [settings.darkMode, applyTheme]);

  return { settings, updateSettings, applyTheme: () => applyTheme(settings.darkMode) };
}
