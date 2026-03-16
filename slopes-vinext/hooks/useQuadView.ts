"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "quadViewSelections";
const SLOT_COUNT = 4;

function loadSelections(): string[] {
  if (typeof window === "undefined") return Array(SLOT_COUNT).fill("") as string[];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(SLOT_COUNT).fill("") as string[];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const arr = parsed as string[];
      // Ensure always exactly SLOT_COUNT entries
      const result: string[] = Array(SLOT_COUNT).fill("") as string[];
      for (let i = 0; i < SLOT_COUNT; i++) {
        result[i] = typeof arr[i] === "string" ? arr[i] : "";
      }
      return result;
    }
    return Array(SLOT_COUNT).fill("") as string[];
  } catch {
    return Array(SLOT_COUNT).fill("") as string[];
  }
}

export function useQuadView() {
  const [quadSelections, setQuadSelections] = useState<string[]>(loadSelections);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quadSelections));
    }
  }, [quadSelections]);

  const updateQuadSelection = useCallback(
    (slotIndex: number, value: string) => {
      setQuadSelections((prev) => {
        const next = [...prev];
        next[slotIndex] = value;
        return next;
      });
    },
    []
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { quadSelections, updateQuadSelection, isOpen, open, close };
}
