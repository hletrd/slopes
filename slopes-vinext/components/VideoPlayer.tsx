"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getYoutubeId, sanitizeForFilename, formatTimestamp, downloadImage } from "@/lib/utils";
import type { WebcamLink } from "@/lib/types";

declare const videojs: any;
declare const html2canvas: any;

interface VideoPlayerProps {
  webcam: WebcamLink;
  playerId: string;
  autoplay: boolean;
  resortId?: string;
  webcamIndex?: number;
  resortName?: string;
  webcamName?: string;
  onBookmark?: () => void;
  isBookmarked?: boolean;
}

export function VideoPlayer({
  webcam,
  playerId,
  autoplay,
  resortId,
  webcamIndex,
  resortName,
  webcamName,
  onBookmark,
  isBookmarked,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const disposedRef = useRef(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const { t } = useI18n();

  const videoUrl = webcam.video || webcam.link || "";
  const videoType = webcam.video_type;

  const showToast = useCallback((message: string, type: string = "success") => {
    const container = containerRef.current;
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `alert alert-${type} position-absolute top-0 start-50 translate-middle-x mt-3 toast-message`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 500);
    }, 2000);
  }, []);

  const captureVideoFrame = useCallback(() => {
    const playerHost = playerHostRef.current;
    if (!playerHost) return;

    const video = playerHost.querySelector("video") as HTMLVideoElement | null;
    if (video) {
      if (video.readyState < 2) {
        showToast(t("errors.videoNotLoaded") || "Video not loaded yet", "warning");
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const rName = sanitizeForFilename(resortName || "resort");
        const wName = sanitizeForFilename(webcamName || "webcam");
        const ts = formatTimestamp();
        const filename = `capture_${rName}_${wName}_${ts}.jpg`;
        const dataURL = canvas.toDataURL("image/jpeg");
        downloadImage(dataURL, filename);
        showToast(t("messages.captureSuccess") || "Captured!", "success");
      } catch {
        showToast(t("errors.captureError") || "Capture failed (cross-origin restriction)", "danger");
      }
      return;
    }

    // For iframes (vivaldi, youtube embeds), use html2canvas
    const iframe = playerHost.querySelector("iframe") as HTMLIFrameElement | null;
    if (iframe) {
      try {
        if (typeof html2canvas !== "undefined" && iframe.contentDocument) {
          const iframeBody = iframe.contentDocument.body;
          html2canvas(iframeBody, { useCORS: false }).then((canvas: HTMLCanvasElement) => {
            try {
              const rName = sanitizeForFilename(resortName || "resort");
              const wName = sanitizeForFilename(webcamName || "webcam");
              const ts = formatTimestamp();
              const filename = `capture_${rName}_${wName}_${ts}.jpg`;
              const dataURL = canvas.toDataURL("image/jpeg");
              downloadImage(dataURL, filename);
              showToast(t("messages.captureSuccess") || "Captured!", "success");
            } catch {
              showToast(t("errors.captureError") || "Capture failed", "danger");
            }
          });
        }
      } catch {
        showToast(t("errors.captureError") || "Capture failed", "danger");
      }
    }
  }, [resortName, webcamName, showToast, t]);

  const togglePip = useCallback(() => {
    const playerHost = playerHostRef.current;
    if (!playerHost) return;
    const video = playerHost.querySelector("video") as HTMLVideoElement | null;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(console.error);
    }
  }, []);

  useEffect(() => {
    const playerHost = playerHostRef.current;
    if (!playerHost || !videoUrl) return;

    disposedRef.current = false;
    setHasPlaybackError(false);

    // Cleanup previous player
    if (playerRef.current && typeof playerRef.current.dispose === "function") {
      try {
        playerRef.current.dispose();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }
    playerHost.innerHTML = "";

    if (videoType === "vivaldi") {
      const params = videoUrl.split(":");
      if (params.length === 2) {
        const channel = params[0];
        const serial = params[1];
        const iframeContainer = document.createElement("div");
        iframeContainer.className = "iframe-container";
        iframeContainer.innerHTML = `<iframe src="/vivaldi.html?channel=${channel}&serial=${serial}&autoplay=${autoplay}" allowfullscreen title="${webcamName || 'Vivaldi player'}"></iframe>`;
        playerHost.appendChild(iframeContainer);
      } else {
        setHasPlaybackError(true);
        playerHost.innerHTML = `<div class="error-message">${t("errors.invalidVivaldiUrl") || "Invalid vivaldi video URL format."}</div>`;
      }
      return;
    }

    if (videoType === "iframe") {
      const iframeContainer = document.createElement("div");
      iframeContainer.className = "iframe-container";
      iframeContainer.innerHTML = `<iframe src="${videoUrl}" allowfullscreen title="${webcamName || 'Video player'}"></iframe>`;
      playerHost.appendChild(iframeContainer);
      return;
    }

    if (videoType === "youtube") {
      const ytId = getYoutubeId(videoUrl);
      if (ytId) {
        const ytContainer = document.createElement("div");
        ytContainer.className = "iframe-container";
        ytContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}?autoplay=${autoplay ? "1" : "0"}&mute=1" allowfullscreen title="${webcamName || 'YouTube player'}"></iframe>`;
        playerHost.appendChild(ytContainer);
      }
      return;
    }

    if (videoType === "link") {
      const linkContainer = document.createElement("div");
      linkContainer.className = "d-flex justify-content-center align-items-center link-container";
      const linkBtn = document.createElement("a");
      linkBtn.href = videoUrl;
      linkBtn.target = "_blank";
      linkBtn.rel = "noopener noreferrer";
      linkBtn.className = "btn btn-primary btn-lg";
      linkBtn.innerHTML = `<i class="bi bi-box-arrow-up-right me-2" aria-hidden="true"></i>${t("buttons.externalLink") || "Open Link"}`;
      linkContainer.appendChild(linkBtn);
      playerHost.appendChild(linkContainer);
      return;
    }

    // Default: HLS via video.js
    const videoEl = document.createElement("video");
    videoEl.id = `webcam-player-${playerId}`;
    videoEl.className = "video-js vjs-theme-forest vjs-big-play-centered";
    videoEl.setAttribute("controls", "");
    if (autoplay) videoEl.setAttribute("autoplay", "");
    videoEl.setAttribute("muted", "");
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("preload", "auto");
    videoEl.setAttribute("crossorigin", "anonymous");

    const source = document.createElement("source");
    source.src = videoUrl;
    source.type = "application/x-mpegURL";
    videoEl.appendChild(source);

    playerHost.appendChild(videoEl);

    // Wait for videojs to be available (loaded via CDN in layout)
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max

    const initPlayer = () => {
      if (disposedRef.current) return;

      if (typeof videojs === "undefined") {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(initPlayer, 100);
        } else {
          setHasPlaybackError(true);
          playerHost.innerHTML = `<div class="error-message">${t("errors.videoPlayerError") || "Video player failed to load"}</div>`;
        }
        return;
      }
      try {
        const player = videojs(`webcam-player-${playerId}`, {
          autoplay,
          muted: true,
          controls: true,
          preload: "auto",
          fluid: true,
          html5: {
            hls: {
              enableLowInitialPlaylist: true,
              smoothQualityChange: true,
              overrideNative: true,
            },
            nativeVideoTracks: false,
            nativeAudioTracks: false,
          },
          controlBar: {
            captionsButton: false,
            pictureInPictureToggle: false,
          },
          notSupportedMessage: t("errors.videoPlayback") || "Video playback error",
        });

        player.on("error", () => {
          // Dispose old player before showing error UI
          if (playerRef.current && typeof playerRef.current.dispose === "function") {
            try {
              playerRef.current.dispose();
            } catch {
              // ignore
            }
            playerRef.current = null;
          }

          const directLink = webcam.link || null;
          let errorHtml = `<div class="error-message"><p>${t("errors.videoPlayback") || "Video playback error"}</p>`;
          errorHtml += '<div class="d-flex justify-content-center gap-2 mt-3 flex-wrap">';
          if (directLink) {
            errorHtml += `<a href="${directLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary"><i class="bi bi-box-arrow-up-right me-2" aria-hidden="true"></i>${t("buttons.originalLink") || "Original"}</a>`;
          }
          errorHtml += `<button class="btn btn-secondary retry-button"><i class="bi bi-arrow-clockwise me-2" aria-hidden="true"></i>${t("buttons.retry") || "Retry"}</button>`;
          errorHtml += "</div></div>";
          setHasPlaybackError(true);
          playerHost.innerHTML = errorHtml;

          const retryBtn = playerHost.querySelector(".retry-button");
          if (retryBtn) {
            retryBtn.addEventListener("click", (e) => {
              e.preventDefault();
              setHasPlaybackError(false);
              playerHost.innerHTML = "";
              playerHost.appendChild(videoEl);
              retryCount = 0;
              initPlayer();
            });
          }
        });

        playerRef.current = player;
      } catch (e) {
        console.error("Error creating video player:", e);
        setHasPlaybackError(true);
        playerHost.innerHTML = `<div class="error-message">${t("errors.videoPlayerError") || "Video player error"}</div>`;
      }
    };

    initPlayer();

    return () => {
      disposedRef.current = true;
      if (playerRef.current && typeof playerRef.current.dispose === "function") {
        try {
          playerRef.current.dispose();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoUrl, videoType, autoplay, playerId, t, webcam.link, webcamName]);

  if (!videoUrl) {
    return <div className="error-message">{t("errors.noVideoStream") || "No video stream available"}</div>;
  }

  const showCaptureButton = !hasPlaybackError && videoType !== "link";
  const showPipButton = !hasPlaybackError && (!videoType || videoType === undefined);

  return (
    <div className="video-container" ref={containerRef}>
      <div className="video-player-host" ref={playerHostRef} />
      {/* Video content rendered imperatively via useEffect */}
      {showCaptureButton && (
        <button className="capture-button" onClick={captureVideoFrame} aria-label={t("buttons.capture") || "Capture"}>
          <i className="bi bi-camera" aria-hidden="true" /> {t("buttons.capture") || "Capture"}
        </button>
      )}
      {showPipButton && (
        <button className="pip-button" onClick={togglePip} aria-label="Picture in Picture">
          <i className="bi bi-pip" aria-hidden="true" /> PIP
        </button>
      )}
      {onBookmark && resortId !== undefined && webcamIndex !== undefined && (
        <button
          className={`bookmark-button${isBookmarked ? " active" : ""}`}
          onClick={onBookmark}
          aria-label={isBookmarked ? (t("buttons.removeBookmark") || "Remove Bookmark") : (t("buttons.bookmark") || "Bookmark")}
          aria-pressed={isBookmarked}
        >
          <span className="bookmark-icon">
            <i className={`bi ${isBookmarked ? "bi-bookmark-fill" : "bi-bookmark"}`} aria-hidden="true" />
          </span>
          {t("buttons.bookmark") || "Bookmark"}
        </button>
      )}
    </div>
  );
}
