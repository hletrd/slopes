"use client";

import { useCallback, useEffect, useRef } from "react";

const MAX_CONCURRENT_MOBILE = 4;
const MAX_CONCURRENT_DESKTOP = 9;

interface ManagedPlayer {
  id: string;
  element: HTMLElement;
  play: () => void;
  pause: () => void;
  isPlaying: boolean;
}

function getMaxConcurrent(): number {
  if (typeof window === "undefined") return MAX_CONCURRENT_DESKTOP;
  return window.innerWidth <= 768 ? MAX_CONCURRENT_MOBILE : MAX_CONCURRENT_DESKTOP;
}

export function useVideoManager() {
  const playersRef = useRef<Map<string, ManagedPlayer>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleRef = useRef<Set<string>>(new Set());

  const enforceLimit = useCallback(() => {
    const maxConcurrent = getMaxConcurrent();
    const visible = visibleRef.current;
    const players = playersRef.current;

    // Collect currently playing players
    const playing: ManagedPlayer[] = [];
    const visibleNotPlaying: ManagedPlayer[] = [];

    for (const player of players.values()) {
      if (player.isPlaying) {
        playing.push(player);
      } else if (visible.has(player.id)) {
        visibleNotPlaying.push(player);
      }
    }

    // If over limit, pause off-screen players first
    if (playing.length > maxConcurrent) {
      const offScreenPlaying = playing.filter(p => !visible.has(p.id));
      for (const p of offScreenPlaying) {
        if (playing.length <= maxConcurrent) break;
        p.pause();
        p.isPlaying = false;
        playing.splice(playing.indexOf(p), 1);
      }
    }

    // Start visible players if under limit
    for (const p of visibleNotPlaying) {
      if (playing.length >= maxConcurrent) break;
      p.play();
      p.isPlaying = true;
      playing.push(p);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-player-id");
          if (!id) continue;

          if (entry.isIntersecting) {
            visibleRef.current.add(id);
          } else {
            visibleRef.current.delete(id);
          }
        }
        enforceLimit();
      },
      { threshold: 0.1 }
    );

    // Pause all on tab hidden, resume on visible
    const onVisibilityChange = () => {
      if (document.hidden) {
        for (const player of playersRef.current.values()) {
          if (player.isPlaying) {
            player.pause();
          }
        }
      } else {
        for (const player of playersRef.current.values()) {
          if (player.isPlaying && visibleRef.current.has(player.id)) {
            player.play();
          }
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      observerRef.current?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enforceLimit]);

  const register = useCallback(
    (id: string, element: HTMLElement, play: () => void, pause: () => void) => {
      playersRef.current.set(id, { id, element, play, pause, isPlaying: false });
      element.setAttribute("data-player-id", id);
      observerRef.current?.observe(element);
    },
    []
  );

  const unregister = useCallback((id: string) => {
    const player = playersRef.current.get(id);
    if (player) {
      observerRef.current?.unobserve(player.element);
      playersRef.current.delete(id);
      visibleRef.current.delete(id);
    }
  }, []);

  const setPlaying = useCallback((id: string, playing: boolean) => {
    const player = playersRef.current.get(id);
    if (player) {
      player.isPlaying = playing;
    }
  }, []);

  return { register, unregister, setPlaying, enforceLimit };
}
