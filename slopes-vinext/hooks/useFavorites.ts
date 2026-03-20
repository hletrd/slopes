"use client";

import { useCallback, useEffect, useState } from "react";
import type { FavoriteItem } from "@/lib/types";

const STORAGE_KEY = "webcamFavorites";

function isValidFavorite(item: unknown): item is FavoriteItem {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.resortId === "string" &&
    typeof obj.webcamIndex === "number" &&
    typeof obj.webcamName === "string" &&
    typeof obj.resortName === "string" &&
    typeof obj.videoUrl === "string"
  );
}

function loadFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidFavorite);
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }
  }, [favorites]);

  const isFavorite = useCallback(
    (resortId: string, webcamIndex: number): boolean =>
      favorites.some(
        (f) => f.resortId === resortId && f.webcamIndex === webcamIndex
      ),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (
      resortId: string,
      webcamIndex: number,
      webcamName: string,
      resortName: string,
      videoUrl: string,
      videoType?: string
    ) => {
      setFavorites((prev) => {
        const idx = prev.findIndex(
          (f) => f.resortId === resortId && f.webcamIndex === webcamIndex
        );
        if (idx !== -1) {
          return prev.filter((_, i) => i !== idx);
        }
        const item: FavoriteItem = {
          resortId,
          webcamIndex,
          webcamName,
          resortName,
          videoUrl,
          videoType,
        };
        return [...prev, item];
      });
    },
    []
  );

  const reorderFavorites = useCallback(
    (fromIndex: number, toIndex: number) => {
      setFavorites((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex < 0 ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        return next;
      });
    },
    []
  );

  return { favorites, isFavorite, toggleFavorite, reorderFavorites };
}
