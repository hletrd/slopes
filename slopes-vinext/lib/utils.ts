"use client";

import type { Resort, WebcamLink } from "@/lib/types";

export function sanitizeForFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣]/g, "_");
}

export function formatTimestamp(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${mm}-${dd}_${hh}:${min}:${ss}`;
}

export function getYoutubeId(url: string): string | null {
  if (!url) return null;

  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([^?&#]+)/);
  if (watchMatch) return watchMatch[1];

  // youtube.com/embed/ID
  const embedMatch = url.match(/\/embed\/([^?&#]+)/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/live/ID
  const liveMatch = url.match(/\/live\/([^?&#]+)/);
  if (liveMatch) return liveMatch[1];

  return null;
}

export function downloadImage(dataURL: string, filename: string): void {
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (isMobile && navigator.share) {
    fetch(dataURL)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], filename, { type: "image/png" });
        navigator
          .share({ files: [file] })
          .catch(() => {
            // fallback to anchor download if share fails
            triggerAnchorDownload(dataURL, filename);
          });
      })
      .catch(() => {
        triggerAnchorDownload(dataURL, filename);
      });
  } else {
    triggerAnchorDownload(dataURL, filename);
  }
}

function triggerAnchorDownload(dataURL: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function getResortWebcams(resort: Resort): WebcamLink[] {
  return resort.links ?? resort.webcams ?? [];
}
