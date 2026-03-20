import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import React__default, { useState, useEffect, useCallback, createContext, useContext, useRef, createElement } from "react";
import { u as usePathname, g as getLayoutSegmentContext } from "../index.js";
import "../__vite_rsc_assets_manifest.js";
import "react-dom";
import "react-dom/server.edge";
import "node:async_hooks";
const SUPPORTED_LANGUAGES = ["en", "ko"];
const DEFAULT_LANGUAGE = "ko";
const STORAGE_KEY$3 = "webcamLanguage";
const I18nContext = createContext(null);
function getPreferredLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const saved = localStorage.getItem(STORAGE_KEY$3);
  if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
    return saved;
  }
  const browserLang = navigator.language;
  if (browserLang && browserLang.toLowerCase().startsWith("ko")) {
    return "ko";
  }
  return "en";
}
async function loadTranslations(lang) {
  try {
    const response = await fetch(`${"/vinext/"}lang/${lang}.json?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${lang} translations`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading translations for ${lang}:`, error);
    return null;
  }
}
function resolveKey(translations, key, params = {}) {
  const keys = key.split(".");
  let value = translations;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation not found: ${key}`);
      return key;
    }
  }
  if (typeof value !== "string") {
    console.warn(`Translation is not a string: ${key}`);
    return key;
  }
  return value.replace(/\{(\w+)\}/g, (_match, paramName) => {
    const v = params[paramName];
    return v !== void 0 ? String(v) : `{${paramName}}`;
  });
}
function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState({});
  useEffect(() => {
    const preferred = getPreferredLanguage();
    setLanguageState(preferred);
    void (async () => {
      let data = await loadTranslations(preferred);
      if (!data) {
        data = await loadTranslations(DEFAULT_LANGUAGE);
        if (data) setLanguageState(DEFAULT_LANGUAGE);
      }
      if (data) setTranslations(data);
    })();
  }, []);
  const setLanguage = useCallback(async (lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }
    const data = await loadTranslations(lang);
    if (data) {
      setTranslations(data);
      setLanguageState(lang);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY$3, lang);
      }
    }
  }, []);
  const t = useCallback(
    (key, params) => resolveKey(translations, key, params),
    [translations]
  );
  const getResortName = useCallback(
    (resortId, defaultName) => {
      const key = `resorts.${resortId}.name`;
      const result = resolveKey(translations, key);
      return result === key ? defaultName : result;
    },
    [translations]
  );
  const getWebcamName = useCallback(
    (resortId, webcamIndex, defaultName) => {
      const key = `resorts.${resortId}.webcams.${webcamIndex}`;
      const result = resolveKey(translations, key);
      return result === key ? defaultName : result;
    },
    [translations]
  );
  const getWeatherLocationName = useCallback(
    (name) => {
      const key = `weatherLocations.${name}`;
      const result = resolveKey(translations, key);
      return result === key ? name : result;
    },
    [translations]
  );
  const getSupportedLanguages = useCallback(
    () => [...SUPPORTED_LANGUAGES],
    []
  );
  const value = {
    t,
    getResortName,
    getWebcamName,
    getWeatherLocationName,
    language,
    setLanguage,
    getSupportedLanguages
  };
  return /* @__PURE__ */ jsx(I18nContext.Provider, { value, children });
}
function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
const STORAGE_KEY$2 = "webcamSettings";
function getDefaultSettings() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  return {
    autoplay: !isMobile,
    darkMode: true,
    quadViewOpen: false
  };
}
function loadSettings() {
  const defaults = getDefaultSettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY$2);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const applyTheme = useCallback((darkMode) => {
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
    (partial) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY$2, JSON.stringify(next));
        }
        if (partial.darkMode !== void 0) {
          applyTheme(partial.darkMode);
        }
        return next;
      });
    },
    [applyTheme]
  );
  useEffect(() => {
    applyTheme(settings.darkMode);
  }, [settings.darkMode, applyTheme]);
  return { settings, updateSettings, applyTheme: () => applyTheme(settings.darkMode) };
}
const STORAGE_KEY$1 = "webcamFavorites";
function loadFavorites() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY$1);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function useFavorites() {
  const [favorites, setFavorites] = useState(loadFavorites);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY$1, JSON.stringify(favorites));
    }
  }, [favorites]);
  const isFavorite = useCallback(
    (resortId, webcamIndex) => favorites.some(
      (f) => f.resortId === resortId && f.webcamIndex === webcamIndex
    ),
    [favorites]
  );
  const toggleFavorite = useCallback(
    (resortId, webcamIndex, webcamName, resortName, videoUrl, videoType) => {
      setFavorites((prev) => {
        const idx = prev.findIndex(
          (f) => f.resortId === resortId && f.webcamIndex === webcamIndex
        );
        if (idx !== -1) {
          return prev.filter((_, i) => i !== idx);
        }
        const item = {
          resortId,
          webcamIndex,
          webcamName,
          resortName,
          videoUrl,
          videoType
        };
        return [...prev, item];
      });
    },
    []
  );
  const reorderFavorites = useCallback(
    (fromIndex, toIndex) => {
      setFavorites((prev) => {
        if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
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
const STORAGE_KEY = "quadViewSelections";
const SLOT_COUNT = 4;
function loadSelections() {
  if (typeof window === "undefined") return Array(SLOT_COUNT).fill("");
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(SLOT_COUNT).fill("");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const arr = parsed;
      const result = Array(SLOT_COUNT).fill("");
      for (let i = 0; i < SLOT_COUNT; i++) {
        result[i] = typeof arr[i] === "string" ? arr[i] : "";
      }
      return result;
    }
    return Array(SLOT_COUNT).fill("");
  } catch {
    return Array(SLOT_COUNT).fill("");
  }
}
function useQuadView() {
  const [quadSelections, setQuadSelections] = useState(loadSelections);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quadSelections));
    }
  }, [quadSelections]);
  const updateQuadSelection = useCallback(
    (slotIndex, value) => {
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
function sanitizeForFilename(name) {
  return name.replace(/[^a-zA-Z0-9가-힣]/g, "_");
}
function formatTimestamp() {
  const now = /* @__PURE__ */ new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${mm}-${dd}_${hh}:${min}:${ss}`;
}
function getYoutubeId(url) {
  if (!url) return null;
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return shortMatch[1];
  const watchMatch = url.match(/[?&]v=([^?&#]+)/);
  if (watchMatch) return watchMatch[1];
  const embedMatch = url.match(/\/embed\/([^?&#]+)/);
  if (embedMatch) return embedMatch[1];
  const liveMatch = url.match(/\/live\/([^?&#]+)/);
  if (liveMatch) return liveMatch[1];
  return null;
}
function downloadImage(dataURL, filename) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  if (isMobile && navigator.share) {
    fetch(dataURL).then((res) => res.blob()).then((blob) => {
      const file = new File([blob], filename, { type: "image/png" });
      navigator.share({ files: [file] }).catch(() => {
        triggerAnchorDownload(dataURL, filename);
      });
    }).catch(() => {
      triggerAnchorDownload(dataURL, filename);
    });
  } else {
    triggerAnchorDownload(dataURL, filename);
  }
}
function triggerAnchorDownload(dataURL, filename) {
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function getResortWebcams(resort) {
  return resort.links ?? resort.webcams ?? [];
}
function VideoPlayer({
  webcam,
  playerId,
  autoplay,
  resortId,
  webcamIndex,
  resortName,
  webcamName,
  onBookmark,
  isBookmarked
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const { t } = useI18n();
  const videoUrl = webcam.video || webcam.link || "";
  const videoType = webcam.video_type;
  const showToast = useCallback((message, type = "success") => {
    const container = containerRef.current;
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `alert alert-${type} position-absolute top-0 start-50 translate-middle-x mt-3 toast-message`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 500);
    }, 2e3);
  }, []);
  const captureVideoFrame = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const video = container.querySelector("video");
    if (video) {
      if (video.readyState < 2) {
        showToast(t("errors.videoNotLoaded") || "Video not loaded yet", "warning");
        return;
      }
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
      return;
    }
    const iframe = container.querySelector("iframe");
    if (iframe) {
      try {
        if (typeof html2canvas !== "undefined" && iframe.contentDocument) {
          const iframeBody = iframe.contentDocument.body;
          html2canvas(iframeBody, { useCORS: false }).then((canvas) => {
            const rName = sanitizeForFilename(resortName || "resort");
            const wName = sanitizeForFilename(webcamName || "webcam");
            const ts = formatTimestamp();
            const filename = `capture_${rName}_${wName}_${ts}.jpg`;
            const dataURL = canvas.toDataURL("image/jpeg");
            downloadImage(dataURL, filename);
            showToast(t("messages.captureSuccess") || "Captured!", "success");
          });
        }
      } catch {
        showToast(t("errors.captureError") || "Capture failed", "danger");
      }
    }
  }, [resortName, webcamName, showToast, t]);
  const togglePip = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const video = container.querySelector("video");
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(console.error);
    }
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoUrl) return;
    if (playerRef.current && typeof playerRef.current.dispose === "function") {
      try {
        playerRef.current.dispose();
      } catch {
      }
      playerRef.current = null;
    }
    container.innerHTML = "";
    if (videoType === "vivaldi") {
      const params = videoUrl.split(":");
      if (params.length === 2) {
        const channel = params[0];
        const serial = params[1];
        const iframeContainer = document.createElement("div");
        iframeContainer.className = "iframe-container";
        iframeContainer.innerHTML = `<iframe src="/vivaldi.html?channel=${channel}&serial=${serial}&autoplay=${autoplay}" allowfullscreen></iframe>`;
        container.appendChild(iframeContainer);
      } else {
        container.innerHTML = '<div class="error-message">Invalid vivaldi video URL format.</div>';
      }
      return;
    }
    if (videoType === "iframe") {
      const iframeContainer = document.createElement("div");
      iframeContainer.className = "iframe-container";
      iframeContainer.innerHTML = `<iframe src="${videoUrl}" allowfullscreen></iframe>`;
      container.appendChild(iframeContainer);
      return;
    }
    if (videoType === "youtube") {
      const ytId = getYoutubeId(videoUrl);
      if (ytId) {
        const ytContainer = document.createElement("div");
        ytContainer.className = "iframe-container";
        ytContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}?autoplay=${autoplay ? "1" : "0"}&mute=1" allowfullscreen></iframe>`;
        container.appendChild(ytContainer);
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
      linkBtn.innerHTML = `<i class="bi bi-box-arrow-up-right me-2"></i>${t("buttons.externalLink") || "Open Link"}`;
      linkContainer.appendChild(linkBtn);
      container.appendChild(linkContainer);
      return;
    }
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
    container.appendChild(videoEl);
    const initPlayer = () => {
      if (typeof videojs === "undefined") {
        setTimeout(initPlayer, 100);
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
              overrideNative: true
            },
            nativeVideoTracks: false,
            nativeAudioTracks: false
          },
          controlBar: {
            captionsButton: false,
            pictureInPictureToggle: false
          },
          notSupportedMessage: t("errors.videoPlayback") || "Video playback error"
        });
        player.on("error", () => {
          const directLink = webcam.link || null;
          let errorHtml = `<div class="error-message"><p>${t("errors.videoPlayback") || "Video playback error"}</p>`;
          errorHtml += '<div class="d-flex justify-content-center gap-2 mt-3 flex-wrap">';
          if (directLink) {
            errorHtml += `<a href="${directLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary"><i class="bi bi-box-arrow-up-right me-2"></i>${t("buttons.originalLink") || "Original"}</a>`;
          }
          errorHtml += `<button class="btn btn-secondary retry-button"><i class="bi bi-arrow-clockwise me-2"></i>${t("buttons.retry") || "Retry"}</button>`;
          errorHtml += "</div></div>";
          container.innerHTML = errorHtml;
          const retryBtn = container.querySelector(".retry-button");
          if (retryBtn) {
            retryBtn.addEventListener("click", (e) => {
              e.preventDefault();
              container.innerHTML = "";
              container.appendChild(videoEl);
              initPlayer();
            });
          }
        });
        playerRef.current = player;
      } catch (e) {
        console.error("Error creating video player:", e);
        container.innerHTML = '<div class="error-message">Video player error</div>';
      }
    };
    initPlayer();
    return () => {
      if (playerRef.current && typeof playerRef.current.dispose === "function") {
        try {
          playerRef.current.dispose();
        } catch {
        }
        playerRef.current = null;
      }
    };
  }, [videoUrl, videoType, autoplay, playerId, t, webcam.link]);
  if (!videoUrl) {
    return /* @__PURE__ */ jsx("div", { className: "error-message", children: "No video stream available" });
  }
  const showCaptureButton = videoType !== "link";
  const showPipButton = !videoType || videoType === void 0;
  return /* @__PURE__ */ jsxs("div", { className: "video-container", ref: containerRef, children: [
    showCaptureButton && /* @__PURE__ */ jsxs("button", { className: "capture-button", onClick: captureVideoFrame, children: [
      /* @__PURE__ */ jsx("i", { className: "bi bi-camera" }),
      " ",
      t("buttons.capture") || "Capture"
    ] }),
    showPipButton && /* @__PURE__ */ jsxs("button", { className: "pip-button", onClick: togglePip, children: [
      /* @__PURE__ */ jsx("i", { className: "bi bi-pip" }),
      " PIP"
    ] }),
    onBookmark && resortId !== void 0 && webcamIndex !== void 0 && /* @__PURE__ */ jsxs(
      "button",
      {
        className: `bookmark-button${isBookmarked ? " active" : ""}`,
        onClick: onBookmark,
        children: [
          /* @__PURE__ */ jsx("span", { className: "bookmark-icon", children: /* @__PURE__ */ jsx("i", { className: `bi ${isBookmarked ? "bi-bookmark-fill" : "bi-bookmark"}` }) }),
          t("buttons.bookmark") || "Bookmark"
        ]
      }
    )
  ] });
}
function WeatherMetric({ className, icon, value, unit, decimals = 1 }) {
  return /* @__PURE__ */ jsxs("span", { className, children: [
    /* @__PURE__ */ jsx("i", { className: icon }),
    Number(value).toFixed(decimals),
    unit
  ] });
}
function WeatherDataRow({ data }) {
  return /* @__PURE__ */ jsxs("div", { className: "weather-data", children: [
    data.temperature !== null && /* @__PURE__ */ jsx(WeatherMetric, { className: "temperature", icon: "bi bi-thermometer-half", value: data.temperature, unit: "°C" }),
    data.humidity !== null && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("span", { children: " • " }),
      /* @__PURE__ */ jsx(WeatherMetric, { className: "humidity", icon: "bi bi-moisture", value: data.humidity, unit: "%", decimals: 0 })
    ] }),
    data.wind_speed !== null && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("span", { children: " • " }),
      /* @__PURE__ */ jsx(WeatherMetric, { className: "wind-speed", icon: "bi bi-wind", value: data.wind_speed, unit: "m/s" })
    ] }),
    data.rainfall !== null && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("span", { children: " • " }),
      /* @__PURE__ */ jsx(WeatherMetric, { className: "rainfall", icon: "bi bi-droplet-fill", value: data.rainfall, unit: "mm" })
    ] }),
    data.snowfall_3hr !== null && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("span", { children: " • " }),
      /* @__PURE__ */ jsx(WeatherMetric, { className: "snowfall", icon: "bi bi-snow", value: data.snowfall_3hr, unit: "cm" })
    ] })
  ] });
}
function WeatherDisplay({ weatherData, resortName, showSource = true }) {
  const { t, getWeatherLocationName } = useI18n();
  const resortWeather = weatherData.filter((w) => w.resort === resortName);
  if (resortWeather.length === 0) return null;
  return /* @__PURE__ */ jsx("div", { className: "weather-container", children: resortWeather.map((locationData) => {
    if (!locationData?.data?.length) return null;
    const mostRecent = locationData.data[locationData.data.length - 1];
    let displayName = locationData.name;
    if (displayName.startsWith("리조트_")) {
      displayName = getWeatherLocationName(displayName.replace("리조트_", ""));
    } else {
      displayName = getWeatherLocationName(displayName);
    }
    let timeStr = "";
    if (locationData.timestamp) {
      const date = new Date(locationData.timestamp);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      timeStr = t("weather.updateTime", { month, day, hours, minutes }) || `${month}/${day} ${hours}:${minutes}`;
      if (showSource) {
        if (locationData.name.startsWith("리조트_")) {
          timeStr += ` (${t("weather.resortProvided") || "Resort"})`;
        } else {
          timeStr += ` (${t("weather.kmaProvided") || "KMA"})`;
        }
      }
    }
    return /* @__PURE__ */ jsx("div", { className: "weather-info-wrapper", children: /* @__PURE__ */ jsxs("div", { className: "weather-info", children: [
      /* @__PURE__ */ jsxs("div", { className: "location-name", children: [
        displayName,
        timeStr && /* @__PURE__ */ jsx("span", { className: "weather-update-time", children: timeStr })
      ] }),
      /* @__PURE__ */ jsx(WeatherDataRow, { data: mostRecent })
    ] }) }, `${locationData.resort}-${locationData.name}`);
  }) });
}
function AllResortsWeather({ weatherData, resortNames }) {
  const { t, getResortName: getResortNameI18n, getWeatherLocationName } = useI18n();
  if (!weatherData.length || !resortNames.length) return null;
  const kmaEntries = [];
  const resortEntries = [];
  for (const resort of resortNames) {
    const baseWeather = weatherData.find((w) => w.resort === resort.name && w.name === "스키하우스");
    if (baseWeather?.data?.length) {
      const mostRecent = baseWeather.data[baseWeather.data.length - 1];
      kmaEntries.push({
        resortId: resort.id,
        displayName: getResortNameI18n(resort.id, resort.name),
        data: mostRecent,
        timestamp: baseWeather.timestamp
      });
    }
    const resortProvided = weatherData.filter((w) => w.resort === resort.name && w.name.startsWith("리조트_"));
    for (const rp of resortProvided) {
      if (rp?.data?.length) {
        const mostRecent = rp.data[rp.data.length - 1];
        const locName = rp.name.replace("리조트_", "");
        resortEntries.push({
          resortId: resort.id,
          displayName: getWeatherLocationName(locName),
          data: mostRecent,
          timestamp: rp.timestamp
        });
      }
    }
  }
  if (!kmaEntries.length && !resortEntries.length) return null;
  return /* @__PURE__ */ jsxs("div", { className: "all-resorts-weather", children: [
    kmaEntries.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("h3", { children: [
        t("weather.allResortsTitle") || "Weather",
        " ",
        /* @__PURE__ */ jsx("span", { style: { fontSize: "0.6em", fontWeight: "normal", color: "#999", marginLeft: 6 }, children: t("weather.kmaData") || "KMA data" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "weather-container", children: kmaEntries.map((entry) => /* @__PURE__ */ jsx("div", { className: "weather-info-wrapper", children: /* @__PURE__ */ jsxs("div", { className: "weather-info", children: [
        /* @__PURE__ */ jsx("span", { className: "location-name", children: entry.displayName }),
        /* @__PURE__ */ jsx(WeatherDataRow, { data: entry.data })
      ] }) }, `kma-${entry.resortId}`)) })
    ] }),
    resortEntries.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("h3", { style: { marginTop: 16 }, children: [
        t("weather.allResortsTitle") || "Weather",
        " ",
        /* @__PURE__ */ jsx("span", { style: { fontSize: "0.6em", fontWeight: "normal", color: "#999", marginLeft: 6 }, children: t("weather.resortData") || "Resort data" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "weather-container", children: resortEntries.map((entry, idx) => /* @__PURE__ */ jsx("div", { className: "weather-info-wrapper", children: /* @__PURE__ */ jsxs("div", { className: "weather-info", children: [
        /* @__PURE__ */ jsx("span", { className: "location-name", children: entry.displayName }),
        /* @__PURE__ */ jsx(WeatherDataRow, { data: entry.data })
      ] }) }, `resort-${entry.resortId}-${idx}`)) })
    ] })
  ] });
}
function ForecastView() {
  const { t } = useI18n();
  const [forecasts, setForecasts] = useState([]);
  const chartsRef = useRef(/* @__PURE__ */ new Map());
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${"/vinext/"}forecast.json?v=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setForecasts(data);
        }
      } catch {
      }
    })();
    return () => {
      for (const chart of chartsRef.current.values()) {
        if (chart && typeof chart.destroy === "function") {
          chart.destroy();
        }
      }
      chartsRef.current.clear();
    };
  }, []);
  useEffect(() => {
    if (!forecasts.length || typeof Chart === "undefined") return;
    for (const chart of chartsRef.current.values()) {
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    }
    chartsRef.current.clear();
    forecasts.forEach((forecast) => {
      const canvasId = `forecast-chart-${forecast.resort}-${forecast.name}`.replace(/\s+/g, "-");
      const canvas = document.getElementById(canvasId);
      if (!canvas || !forecast.data?.length) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const labels = forecast.data.map((d) => d.time);
      const temps = forecast.data.map((d) => d.temperature);
      const winds = forecast.data.map((d) => d.wind_speed);
      const snows = forecast.data.map((d) => d.snowfall_3hr);
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      const textColor = isDark ? "#ccc" : "#333";
      const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: t("weather.temperature") || "Temperature (°C)",
              data: temps,
              borderColor: "#ff6384",
              backgroundColor: "rgba(255, 99, 132, 0.1)",
              yAxisID: "y",
              tension: 0.3
            },
            {
              label: t("weather.windSpeed") || "Wind (m/s)",
              data: winds,
              borderColor: "#36a2eb",
              backgroundColor: "rgba(54, 162, 235, 0.1)",
              yAxisID: "y",
              tension: 0.3
            },
            {
              label: t("weather.snowfall") || "Snow (cm/3hr)",
              data: snows,
              borderColor: "#4bc0c0",
              backgroundColor: "rgba(75, 192, 192, 0.3)",
              type: "bar",
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: {
              ticks: { color: textColor, maxRotation: 45 },
              grid: { color: gridColor }
            },
            y: {
              type: "linear",
              position: "left",
              ticks: { color: textColor },
              grid: { color: gridColor }
            },
            y1: {
              type: "linear",
              position: "right",
              min: 0,
              ticks: { color: textColor },
              grid: { drawOnChartArea: false }
            }
          },
          plugins: {
            legend: { labels: { color: textColor } }
          }
        }
      });
      chartsRef.current.set(canvasId, chart);
    });
  }, [forecasts, t]);
  if (!forecasts.length) {
    return /* @__PURE__ */ jsxs("div", { className: "content-section active", children: [
      /* @__PURE__ */ jsx("h2", { children: t("nav.forecast") || "Forecast" }),
      /* @__PURE__ */ jsx("p", { children: t("weather.noForecast") || "Loading forecast data..." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "content-section active", children: [
    /* @__PURE__ */ jsx("h2", { children: t("nav.forecast") || "Forecast" }),
    /* @__PURE__ */ jsx("div", { className: "forecast-charts", children: forecasts.map((forecast) => {
      const canvasId = `forecast-chart-${forecast.resort}-${forecast.name}`.replace(/\s+/g, "-");
      return /* @__PURE__ */ jsxs("div", { className: "forecast-chart-wrapper", style: { marginBottom: 24 }, children: [
        /* @__PURE__ */ jsx("h4", { children: forecast.name }),
        forecast.update_time && /* @__PURE__ */ jsxs("p", { style: { fontSize: "0.8em", color: "#999" }, children: [
          t("weather.updated") || "Updated",
          ": ",
          forecast.update_time
        ] }),
        /* @__PURE__ */ jsx("div", { style: { height: 300 }, children: /* @__PURE__ */ jsx("canvas", { id: canvasId }) })
      ] }, canvasId);
    }) })
  ] });
}
function parseHash(hash) {
  const h = hash.replace(/^#/, "");
  if (!h) return { kind: "home" };
  if (h === "quad") return { kind: "quad" };
  if (h === "misc/forecast") return { kind: "forecast" };
  const parts = h.split("/");
  if (parts.length === 1) return { kind: "resort", resortId: parts[0] };
  const idx = parseInt(parts[1], 10);
  if (!isNaN(idx))
    return { kind: "webcam", resortId: parts[0], webcamIndex: idx };
  return { kind: "resort", resortId: parts[0] };
}
function routeToHash(route) {
  switch (route.kind) {
    case "home":
      return "#";
    case "resort":
      return `#${route.resortId}`;
    case "webcam":
      return `#${route.resortId}/${route.webcamIndex}`;
    case "quad":
      return "#quad";
    case "forecast":
      return "#misc/forecast";
  }
}
function MobileNav({ onToggleSidebar }) {
  return /* @__PURE__ */ jsx("div", { className: "mobile-nav", children: /* @__PURE__ */ jsxs("div", { className: "mobile-nav-inner", children: [
    /* @__PURE__ */ jsx("button", { className: "toggle-menu btn", onClick: onToggleSidebar, children: "☰" }),
    /* @__PURE__ */ jsx("div", { className: "mobile-title", children: /* @__PURE__ */ jsx("a", { href: "./", children: "Slopes cam" }) }),
    /* @__PURE__ */ jsx("div", { style: { width: 24 } })
  ] }) });
}
function InfoButton({ onClick }) {
  return /* @__PURE__ */ jsx("button", { id: "infoButton", className: "info-button", onClick, children: /* @__PURE__ */ jsx("i", { className: "bi bi-file-earmark-text" }) });
}
function FloatingButtons({
  onSettings,
  onQuadView,
  onAddToHome
}) {
  return /* @__PURE__ */ jsxs("div", { className: "floating-button-group", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        id: "addToHomeButton",
        className: "add-to-home",
        title: "홈 화면에 추가",
        onClick: onAddToHome,
        children: /* @__PURE__ */ jsx("i", { className: "bi bi-house-add" })
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        id: "settingsButton",
        className: "settings-button",
        onClick: onSettings,
        children: /* @__PURE__ */ jsx("i", { className: "bi bi-gear" })
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        id: "quadViewButton",
        className: "quad-view-button",
        title: "4분할 모드",
        "aria-label": "4분할 모드",
        onClick: onQuadView,
        children: /* @__PURE__ */ jsx("i", { className: "bi bi-border-all" })
      }
    )
  ] });
}
function InfoModal({ open, onClose }) {
  if (!open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      id: "infoModal",
      className: "info-modal",
      style: { display: "flex" },
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      children: /* @__PURE__ */ jsxs("div", { className: "info-content", children: [
        /* @__PURE__ */ jsx("button", { className: "info-close", onClick: onClose, children: /* @__PURE__ */ jsx("i", { className: "bi bi-x" }) }),
        /* @__PURE__ */ jsx("h4", { className: "info-title", children: "Slopes cam" }),
        /* @__PURE__ */ jsxs("div", { className: "info-text", children: [
          /* @__PURE__ */ jsx("p", { children: "Q. 일부 영상이 재생되지 않거나 오류가 있습니다." }),
          /* @__PURE__ */ jsx("p", { children: "A. 각 영상은 스키장에서 제공하는 실시간 웹캠 영상으로, 본 웹사이트는 영상을 저장하거나 재전송하지 않고 단순히 원본 영상의 링크만을 연결합니다." }),
          /* @__PURE__ */ jsxs("ul", { children: [
            /* @__PURE__ */ jsx("li", { children: "스키장에 따라 영상 제공 방식이 상이하므로 재생 방식이 다를 수 있습니다." }),
            /* @__PURE__ */ jsx("li", { children: "스키장의 사정에 따라 영상이 제공되지 않거나 변경될 수 있습니다." }),
            /* @__PURE__ */ jsx("li", { children: "스키장의 사정에 의해 영상이 일시적으로, 또는 영구적으로 서비스 중단될 수 있습니다." }),
            /* @__PURE__ */ jsx("li", { children: "모바일에서는 동시에 재생 가능한 영상의 수에 제한이 있을 수 있으며, 전체보기가 되지 않을 수 있습니다." })
          ] }),
          /* @__PURE__ */ jsx("p", { children: "Q. 날씨 정보가 정확하지 않습니다." }),
          /* @__PURE__ */ jsxs("p", { children: [
            "A. 날씨 정보는 실시간 관측 정보를 바탕으로 3차원 모델을 통해 계산된 정보입니다. 날씨 정보는",
            " ",
            /* @__PURE__ */ jsx("a", { href: "https://apihub.kma.go.kr/", target: "_blank", rel: "noreferrer", children: "기상청 API허브" }),
            "에서 제공하는 융합기상 데이터를 공공누리 제1유형 라이센스로 사용하고 있습니다."
          ] }),
          /* @__PURE__ */ jsxs("ul", { children: [
            /* @__PURE__ */ jsx("li", { children: "날씨 정보는 국지적인 정보를 정확히 반영하지 않을 수 있으며, 부정확한 정보를 포함할 수 있습니다." }),
            /* @__PURE__ */ jsx("li", { children: "풍속은 10분 풍속, 강수량은 1시간 강수량이며, 적설량은 3시간 적설량입니다." })
          ] }),
          /* @__PURE__ */ jsx("p", { children: "Q. 왜 만든 건가요?" }),
          /* @__PURE__ */ jsx("p", { children: "A. 스키장 영상과 날씨를 바로 모아볼 수 있는 페이지가 없어서 만들었습니다." }),
          /* @__PURE__ */ jsxs("ul", { children: [
            /* @__PURE__ */ jsx("li", { children: "스키장 공식 홈페이지에서 제공하는 영상은 모바일에서 보기가 불편했습니다." }),
            /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx(
                "a",
                {
                  target: "_blank",
                  href: "https://ski-resort.kr/",
                  rel: "noreferrer",
                  children: "ski-resort.kr"
                }
              ),
              "와",
              " ",
              /* @__PURE__ */ jsx(
                "a",
                {
                  target: "_blank",
                  href: "https://paulkim-xr.github.io/SkiWatch/",
                  rel: "noreferrer",
                  children: "SkiWatch"
                }
              ),
              "도 참고했습니다만, 원하는 영상을 모아볼 수 있는 기능이 없고 비발디파크를 제대로 지원하지 않아 직접 만들었습니다."
            ] })
          ] })
        ] })
      ] })
    }
  );
}
function SettingsModal({
  open,
  onClose,
  autoplay,
  darkMode,
  language,
  onAutoplayChange,
  onDarkModeChange,
  onLanguageChange
}) {
  if (!open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      id: "settingsModal",
      className: "settings-modal",
      style: { display: "block" },
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      children: /* @__PURE__ */ jsxs("div", { className: "settings-content", children: [
        /* @__PURE__ */ jsx("button", { className: "settings-close", onClick: onClose, children: /* @__PURE__ */ jsx("i", { className: "bi bi-x" }) }),
        /* @__PURE__ */ jsx("h4", { className: "settings-title", children: "설정" }),
        /* @__PURE__ */ jsxs("div", { className: "settings-options", children: [
          /* @__PURE__ */ jsxs("div", { className: "setting-item", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "autoplayToggle", children: "동영상 자동 재생" }),
            /* @__PURE__ */ jsxs("div", { className: "toggle-switch", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  id: "autoplayToggle",
                  checked: autoplay,
                  onChange: (e) => onAutoplayChange(e.target.checked)
                }
              ),
              /* @__PURE__ */ jsx("span", { className: "toggle-slider" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "setting-item", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "themeToggle", children: "다크 모드" }),
            /* @__PURE__ */ jsxs("div", { className: "toggle-switch", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  id: "themeToggle",
                  checked: darkMode,
                  onChange: (e) => onDarkModeChange(e.target.checked)
                }
              ),
              /* @__PURE__ */ jsx("span", { className: "toggle-slider" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "setting-item", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "languageSelect", children: "언어" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                id: "languageSelect",
                className: "language-select",
                value: language,
                onChange: (e) => onLanguageChange(e.target.value),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "ko", children: "한국어" }),
                  /* @__PURE__ */ jsx("option", { value: "en", children: "English" })
                ]
              }
            )
          ] })
        ] })
      ] })
    }
  );
}
function BugReportModal({ open, onClose }) {
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      setTitle("");
      setContent("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };
  if (!open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      id: "bugReportModal",
      className: "bug-report-modal active",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      children: /* @__PURE__ */ jsxs("div", { className: "bug-report-content", children: [
        /* @__PURE__ */ jsx("button", { className: "bug-report-close", onClick: onClose, children: /* @__PURE__ */ jsx("i", { className: "bi bi-x" }) }),
        /* @__PURE__ */ jsx("h4", { className: "bug-report-title", children: "문의" }),
        /* @__PURE__ */ jsxs("form", { id: "bugReportForm", onSubmit: handleSubmit, children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "reportType", children: "유형" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                id: "reportType",
                required: true,
                value: type,
                onChange: (e) => setType(e.target.value),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "bug", children: "버그 신고" }),
                  /* @__PURE__ */ jsx("option", { value: "feature", children: "기능 제안" }),
                  /* @__PURE__ */ jsx("option", { value: "other", children: "기타" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "reportTitle", children: "제목" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                id: "reportTitle",
                required: true,
                maxLength: 100,
                placeholder: "제목을 입력해주세요. (최대 100자)",
                value: title,
                onChange: (e) => setTitle(e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "reportContent", children: "내용" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                id: "reportContent",
                rows: 5,
                required: true,
                maxLength: 1e3,
                placeholder: "내용을 입력해주세요. (최대 1000자)",
                value: content,
                onChange: (e) => setContent(e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "submit",
              className: "submit-button",
              disabled: submitting,
              children: "보내기"
            }
          )
        ] })
      ] })
    }
  );
}
function InstallationModal({ open, onClose }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      id: "installationModal",
      className: `installation-modal${open ? " active" : ""}`,
      children: [
        /* @__PURE__ */ jsx("button", { className: "modal-close", onClick: onClose, children: /* @__PURE__ */ jsx("i", { className: "bi bi-x" }) }),
        /* @__PURE__ */ jsx("h4", { children: "홈 화면에 추가" }),
        /* @__PURE__ */ jsxs("div", { className: "installation-steps", children: [
          /* @__PURE__ */ jsxs("div", { id: "iOSInstructions", children: [
            /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "iPhone" }) }),
            /* @__PURE__ */ jsxs("ol", { children: [
              /* @__PURE__ */ jsxs("li", { children: [
                "Safari 브라우저에서 공유 버튼",
                " ",
                /* @__PURE__ */ jsx("i", { className: "bi bi-box-arrow-up" }),
                " 탭"
              ] }),
              /* @__PURE__ */ jsx("li", { children: '"홈 화면에 추가" 선택' }),
              /* @__PURE__ */ jsx("li", { children: '"추가" 버튼 탭' })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { id: "androidInstructions", children: [
            /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("strong", { children: "Android" }) }),
            /* @__PURE__ */ jsxs("ol", { children: [
              /* @__PURE__ */ jsxs("li", { children: [
                "Chrome 메뉴 ",
                /* @__PURE__ */ jsx("i", { className: "bi bi-three-dots-vertical" }),
                " 탭"
              ] }),
              /* @__PURE__ */ jsx("li", { children: '"앱 설치" 또는 "홈 화면에 추가" 선택' })
            ] })
          ] })
        ] })
      ]
    }
  );
}
function QuadView({
  open,
  resorts,
  selections,
  onSelectionChange,
  onClose,
  onAddToHome,
  darkMode,
  autoplay
}) {
  const { t, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();
  if (!open) return null;
  function getSlotWebcam(value) {
    if (!value) return null;
    const [resortId, idxStr] = value.split("/");
    const webcamIndex = parseInt(idxStr, 10);
    const resort = resorts.find((r) => r.id === resortId);
    if (!resort || isNaN(webcamIndex)) return null;
    const webcams = getResortWebcams(resort);
    const wc = webcams[webcamIndex];
    if (!wc) return null;
    return { resort, wc, webcamIndex };
  }
  return /* @__PURE__ */ jsx("div", { id: "quadViewContainer", className: "quad-view-container active", children: /* @__PURE__ */ jsxs(
    "div",
    {
      id: "quadViewPage",
      className: `quad-page${!darkMode ? " light-mode" : ""}`,
      children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            id: "quadBackButton",
            className: "quad-page-back",
            title: t("buttons.back") || "돌아가기",
            onClick: onClose,
            children: /* @__PURE__ */ jsx("i", { className: "bi bi-arrow-left" })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            id: "quadAddToHomeButton",
            className: "quad-page-add-home",
            title: t("buttons.addToHome") || "홈 화면에 추가",
            onClick: onAddToHome,
            children: /* @__PURE__ */ jsx("i", { className: "bi bi-house-add" })
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "quad-grid", children: [0, 1, 2, 3].map((slot) => {
          const slotData = getSlotWebcam(selections[slot] ?? "");
          return /* @__PURE__ */ jsxs("div", { className: "quad-slot", children: [
            /* @__PURE__ */ jsxs(
              "select",
              {
                className: "quad-select",
                value: selections[slot] ?? "",
                onChange: (e) => onSelectionChange(slot, e.target.value),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: t("camera.select") || "카메라 선택" }),
                  resorts.map((resort) => {
                    const webcams = getResortWebcams(resort);
                    if (!webcams.length) return null;
                    return /* @__PURE__ */ jsx("optgroup", { label: getResortNameI18n(resort.id, resort.name), children: webcams.map((wc, idx) => /* @__PURE__ */ jsx("option", { value: `${resort.id}/${idx}`, children: getWebcamNameI18n(resort.id, idx, wc.name) }, idx)) }, resort.id);
                  })
                ]
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "quad-video", children: slotData && /* @__PURE__ */ jsx(
              VideoPlayer,
              {
                webcam: slotData.wc,
                playerId: `quad-${slotData.resort.id}-${slotData.webcamIndex}`,
                autoplay,
                resortName: slotData.resort.name,
                webcamName: slotData.wc.name
              }
            ) })
          ] }, slot);
        }) })
      ]
    }
  ) });
}
function Sidebar({
  resorts,
  activeResortId,
  activeWebcamIndex,
  sidebarOpen,
  onResortClick,
  onWebcamClick
}) {
  const { t, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();
  return /* @__PURE__ */ jsxs("div", { className: `sidebar${sidebarOpen ? " active" : ""}`, children: [
    /* @__PURE__ */ jsx("div", { className: "site-title", children: /* @__PURE__ */ jsx("a", { href: "./", children: "Slopes cam" }) }),
    resorts.map((resort) => {
      const webcams = getResortWebcams(resort);
      const isActive = activeResortId === resort.id;
      return /* @__PURE__ */ jsxs("div", { className: "menu-item-container", children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: `menu-item${isActive && activeWebcamIndex === null ? " active" : ""}`,
            onClick: () => onResortClick(resort.id),
            children: getResortNameI18n(resort.id, resort.name)
          }
        ),
        webcams.length > 0 && /* @__PURE__ */ jsx("div", { className: `submenu${isActive ? " active" : ""}`, children: webcams.map((wc, idx) => /* @__PURE__ */ jsx(
          "div",
          {
            className: `submenu-item${isActive && activeWebcamIndex === idx ? " active" : ""}`,
            onClick: () => onWebcamClick(resort.id, idx),
            children: getWebcamNameI18n(resort.id, idx, wc.name)
          },
          idx
        )) })
      ] }, resort.id);
    }),
    /* @__PURE__ */ jsx("div", { className: "menu-item-container", children: /* @__PURE__ */ jsx(
      "div",
      {
        className: "menu-item",
        onClick: () => {
          window.location.hash = "misc/forecast";
        },
        children: t("nav.forecast") || "예보"
      }
    ) })
  ] });
}
function HomeContent({
  onBugReport,
  weatherData,
  resorts,
  favorites,
  onRemoveFavorite,
  onReorderFavorites,
  autoplay
}) {
  const { t } = useI18n();
  const [dragIndex, setDragIndex] = useState(null);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      id: "default-message",
      className: "content-section content-section-default active",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center p-4", children: [
          /* @__PURE__ */ jsx("h2", { children: t("site.heroTitle") || "전국 스키장 실시간 웹캠 모음" }),
          /* @__PURE__ */ jsx("p", { className: "lead", style: { fontSize: "1.1rem" }, children: t("site.heroSubtitle") || "왼쪽 메뉴에서 스키장 또는 카메라를 선택하세요." }),
          /* @__PURE__ */ jsxs("p", { className: "disclaimer mt-2", style: { fontSize: "0.8rem" }, children: [
            /* @__PURE__ */ jsx("span", { children: t("site.disclaimer") || "사이트 오류 제보, 문의 및 기능 제안" }),
            /* @__PURE__ */ jsx("button", { className: "bug-report-link", onClick: onBugReport, children: t("buttons.bugReport") || "버그 제보" }),
            /* @__PURE__ */ jsx("span", { className: "github-button-issue", children: /* @__PURE__ */ jsx(
              "a",
              {
                className: "github-button github-button-issue",
                href: "https://github.com/hletrd/slopes/issues",
                "data-color-scheme": "no-preference: dark; light: dark; dark: dark;",
                "data-icon": "octicon-issue-opened",
                "aria-label": "Issue hletrd/slopes on GitHub",
                children: "Issue"
              }
            ) })
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "lead github-buttons", children: [
            /* @__PURE__ */ jsx(
              "a",
              {
                className: "github-button",
                href: "https://github.com/hletrd/slopes",
                "data-color-scheme": "no-preference: dark; light: dark; dark: dark;",
                "data-icon": "octicon-star",
                "data-show-count": "true",
                "aria-label": "Star hletrd/slopes on GitHub",
                children: "Star"
              }
            ),
            " ",
            /* @__PURE__ */ jsx(
              "a",
              {
                className: "github-button",
                href: "https://github.com/hletrd",
                "data-color-scheme": "no-preference: dark; light: dark; dark: dark;",
                "data-show-count": "true",
                "aria-label": "Follow @hletrd on GitHub",
                children: "Follow @hletrd"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { id: "favorites-container", style: { display: favorites.length > 0 ? "block" : "none" }, children: [
          /* @__PURE__ */ jsx("h3", { children: t("bookmarks.title") || "Bookmarks" }),
          favorites.length === 0 && /* @__PURE__ */ jsx("div", { className: "instruction", children: /* @__PURE__ */ jsxs("p", { children: [
            t("bookmarks.empty") || "No bookmarks yet.",
            /* @__PURE__ */ jsx("br", {}),
            t("bookmarks.browserOnly") || ""
          ] }) }),
          /* @__PURE__ */ jsx("div", { id: "favorites-grid", className: "videos-grid", children: favorites.map((fav, idx) => {
            const resort = resorts.find((r) => r.id === fav.resortId);
            const webcams = resort ? getResortWebcams(resort) : [];
            const webcam = webcams[fav.webcamIndex];
            return /* @__PURE__ */ jsxs(
              "div",
              {
                className: `video-card favorite-card${dragIndex === idx ? " dragging" : ""}`,
                draggable: true,
                "data-index": idx,
                onDragStart: () => setDragIndex(idx),
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => {
                  if (dragIndex !== null && dragIndex !== idx) {
                    onReorderFavorites(dragIndex, idx);
                  }
                  setDragIndex(null);
                },
                onDragEnd: () => setDragIndex(null),
                children: [
                  /* @__PURE__ */ jsx("div", { className: "drag-handle", children: /* @__PURE__ */ jsx("i", { className: "bi bi-grip-vertical" }) }),
                  /* @__PURE__ */ jsxs("div", { className: "favorites-header-container", children: [
                    /* @__PURE__ */ jsxs("div", { className: "favorite-header", children: [
                      /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: "favorite-location cursor-pointer",
                          onClick: () => {
                            window.location.hash = `${fav.resortId}/${fav.webcamIndex}`;
                          },
                          children: fav.webcamName
                        }
                      ),
                      /* @__PURE__ */ jsx("span", { className: "favorite-resort", children: fav.resortName })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        className: "favorites-remove-button",
                        title: t("buttons.removeBookmark") || "Remove",
                        onClick: (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveFavorite(fav.resortId, fav.webcamIndex);
                        },
                        children: /* @__PURE__ */ jsx("i", { className: "bi bi-trash" })
                      }
                    )
                  ] }),
                  webcam && fav.videoUrl && /* @__PURE__ */ jsx(
                    VideoPlayer,
                    {
                      webcam: { ...webcam, video: fav.videoUrl, video_type: fav.videoType },
                      playerId: `favorite-player-${idx}`,
                      autoplay,
                      resortId: fav.resortId,
                      webcamIndex: fav.webcamIndex,
                      resortName: fav.resortName,
                      webcamName: fav.webcamName
                    }
                  ),
                  (!webcam || !fav.videoUrl) && fav.videoUrl && /* @__PURE__ */ jsx(
                    VideoPlayer,
                    {
                      webcam: { name: fav.webcamName, video: fav.videoUrl, video_type: fav.videoType },
                      playerId: `favorite-player-${idx}`,
                      autoplay,
                      resortName: fav.resortName,
                      webcamName: fav.webcamName
                    }
                  )
                ]
              },
              `${fav.resortId}-${fav.webcamIndex}`
            );
          }) })
        ] }),
        /* @__PURE__ */ jsx(
          AllResortsWeather,
          {
            weatherData,
            resortNames: resorts.map((r) => ({ id: r.id, name: r.name }))
          }
        )
      ]
    }
  );
}
function Footer() {
  return /* @__PURE__ */ jsx("div", { className: "footer", children: "이 서비스는 스키장에서 공식적으로 제공하는 서비스가 아닙니다. 관련하여 스키장에 문의하지 마세요." });
}
function App() {
  const { settings, updateSettings } = useSettings();
  const { favorites, isFavorite, toggleFavorite, reorderFavorites } = useFavorites();
  const { quadSelections, updateQuadSelection, isOpen: quadOpen, open: openQuad, close: closeQuad } = useQuadView();
  const { language, setLanguage, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();
  const [resorts, setResorts] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [activeResortId, setActiveResortId] = useState(null);
  const [activeWebcamIndex, setActiveWebcamIndex] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [installationOpen, setInstallationOpen] = useState(false);
  useEffect(() => {
    if (quadOpen) {
      document.body.classList.add("quad-view-open");
    } else {
      document.body.classList.remove("quad-view-open");
    }
  }, [quadOpen]);
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${"/vinext/"}links.json`);
        if (res.ok) {
          const data = await res.json();
          setResorts(data);
        }
      } catch (e) {
        console.error("Failed to fetch links.json", e);
      }
    })();
    void (async () => {
      try {
        const res = await fetch(`${"/vinext/"}weather.json`);
        if (res.ok) {
          const data = await res.json();
          setWeatherData(data);
        }
      } catch {
      }
    })();
  }, []);
  const applyRoute = useCallback((route) => {
    switch (route.kind) {
      case "home":
        setActiveResortId(null);
        setActiveWebcamIndex(null);
        closeQuad();
        break;
      case "resort":
        setActiveResortId(route.resortId);
        setActiveWebcamIndex(null);
        closeQuad();
        break;
      case "webcam":
        setActiveResortId(route.resortId);
        setActiveWebcamIndex(route.webcamIndex);
        closeQuad();
        break;
      case "quad":
        openQuad();
        break;
      case "forecast":
        setActiveResortId("misc");
        setActiveWebcamIndex(null);
        closeQuad();
        break;
    }
  }, [openQuad, closeQuad]);
  useEffect(() => {
    applyRoute(parseHash(window.location.hash));
    const onHashChange = () => {
      applyRoute(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyRoute]);
  const navigateToResort = useCallback((resortId) => {
    window.location.hash = routeToHash({ kind: "resort", resortId });
    setSidebarOpen(false);
  }, []);
  const navigateToWebcam = useCallback(
    (resortId, webcamIndex) => {
      window.location.hash = routeToHash({
        kind: "webcam",
        resortId,
        webcamIndex
      });
      setSidebarOpen(false);
    },
    []
  );
  const handleQuadOpen = useCallback(() => {
    window.location.hash = "#quad";
  }, []);
  const handleQuadClose = useCallback(() => {
    window.location.hash = "#";
  }, []);
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((v) => !v);
  }, []);
  const handleAddToHome = useCallback(() => {
    setInstallationOpen(true);
  }, []);
  const showHome = !activeResortId;
  const showForecast = activeResortId === "misc";
  const activeResort = resorts.find((r) => r.id === activeResortId) ?? null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(MobileNav, { onToggleSidebar: handleToggleSidebar }),
    /* @__PURE__ */ jsx(InfoButton, { onClick: () => setInfoOpen(true) }),
    /* @__PURE__ */ jsx(
      FloatingButtons,
      {
        onSettings: () => setSettingsOpen(true),
        onQuadView: handleQuadOpen,
        onAddToHome: handleAddToHome
      }
    ),
    /* @__PURE__ */ jsx(InfoModal, { open: infoOpen, onClose: () => setInfoOpen(false) }),
    /* @__PURE__ */ jsx(
      SettingsModal,
      {
        open: settingsOpen,
        onClose: () => setSettingsOpen(false),
        autoplay: settings.autoplay,
        darkMode: settings.darkMode,
        language,
        onAutoplayChange: (v) => updateSettings({ autoplay: v }),
        onDarkModeChange: (v) => updateSettings({ darkMode: v }),
        onLanguageChange: (v) => setLanguage(v)
      }
    ),
    /* @__PURE__ */ jsx(
      BugReportModal,
      {
        open: bugReportOpen,
        onClose: () => setBugReportOpen(false)
      }
    ),
    /* @__PURE__ */ jsx(
      InstallationModal,
      {
        open: installationOpen,
        onClose: () => setInstallationOpen(false)
      }
    ),
    /* @__PURE__ */ jsx(
      QuadView,
      {
        open: quadOpen,
        resorts,
        selections: quadSelections,
        onSelectionChange: updateQuadSelection,
        onClose: handleQuadClose,
        onAddToHome: handleAddToHome,
        darkMode: settings.darkMode,
        autoplay: settings.autoplay
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: `sidebar-backdrop${sidebarOpen ? " active" : ""}`,
        onClick: () => setSidebarOpen(false)
      }
    ),
    /* @__PURE__ */ jsx(
      Sidebar,
      {
        resorts,
        activeResortId,
        activeWebcamIndex,
        sidebarOpen,
        onResortClick: navigateToResort,
        onWebcamClick: navigateToWebcam
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "main-content", children: [
      showHome && /* @__PURE__ */ jsx(
        HomeContent,
        {
          onBugReport: () => setBugReportOpen(true),
          weatherData,
          resorts,
          favorites,
          onRemoveFavorite: (resortId, webcamIndex) => {
            const resort = resorts.find((r) => r.id === resortId);
            const webcams = getResortWebcams(resort);
            const wc = webcams[webcamIndex];
            if (wc) {
              toggleFavorite(resortId, webcamIndex, wc.name, resort?.name ?? "", wc.video || wc.link || "", wc.video_type);
            }
          },
          onReorderFavorites: reorderFavorites,
          autoplay: settings.autoplay
        }
      ),
      showForecast && /* @__PURE__ */ jsx(ForecastView, {}),
      activeResort && !showForecast && /* @__PURE__ */ jsxs("div", { className: "content-section active", children: [
        /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsx("span", { className: "inline-title", children: getResortNameI18n(activeResort.id, activeResort.name) }) }),
        activeWebcamIndex !== null ? (() => {
          const webcams = getResortWebcams(activeResort);
          const wc = webcams[activeWebcamIndex];
          if (!wc) return /* @__PURE__ */ jsx("div", { className: "error-message", children: "Webcam not found" });
          const wcName = getWebcamNameI18n(activeResort.id, activeWebcamIndex, wc.name);
          const resName = getResortNameI18n(activeResort.id, activeResort.name);
          const videoUrl = wc.video || wc.link || "";
          const bookmarked = isFavorite(activeResort.id, activeWebcamIndex);
          return /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "inline-title inline-title-submenu", children: wcName }),
            /* @__PURE__ */ jsx(
              VideoPlayer,
              {
                webcam: wc,
                playerId: `${activeResort.id}-${activeWebcamIndex}`,
                autoplay: settings.autoplay,
                resortId: activeResort.id,
                webcamIndex: activeWebcamIndex,
                resortName: resName,
                webcamName: wcName,
                isBookmarked: bookmarked,
                onBookmark: () => toggleFavorite(
                  activeResort.id,
                  activeWebcamIndex,
                  wcName,
                  resName,
                  videoUrl,
                  wc.video_type
                )
              }
            ),
            /* @__PURE__ */ jsx(
              WeatherDisplay,
              {
                weatherData,
                resortName: activeResort.name
              }
            )
          ] });
        })() : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "videos-grid", children: getResortWebcams(activeResort).map((wc, idx) => {
            const videoUrl = wc.video || wc.link || "";
            if (!videoUrl) return null;
            const wcName = getWebcamNameI18n(activeResort.id, idx, wc.name);
            const resName = getResortNameI18n(activeResort.id, activeResort.name);
            const bookmarked = isFavorite(activeResort.id, idx);
            return /* @__PURE__ */ jsxs("div", { className: "video-card", children: [
              /* @__PURE__ */ jsx(
                "h3",
                {
                  className: "cursor-pointer",
                  onClick: () => navigateToWebcam(activeResort.id, idx),
                  children: wcName
                }
              ),
              /* @__PURE__ */ jsx(
                VideoPlayer,
                {
                  webcam: wc,
                  playerId: `${activeResort.id}-grid-${idx}`,
                  autoplay: settings.autoplay,
                  resortId: activeResort.id,
                  webcamIndex: idx,
                  resortName: resName,
                  webcamName: wcName,
                  isBookmarked: bookmarked,
                  onBookmark: () => toggleFavorite(
                    activeResort.id,
                    idx,
                    wcName,
                    resName,
                    videoUrl,
                    wc.video_type
                  )
                }
              )
            ] }, idx);
          }) }),
          /* @__PURE__ */ jsx(
            WeatherDisplay,
            {
              weatherData,
              resortName: activeResort.name
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Footer, {})
  ] });
}
function Page() {
  return /* @__PURE__ */ jsx(I18nProvider, { children: /* @__PURE__ */ jsx(App, {}) });
}
class ErrorBoundary extends React__default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    if (error && typeof error === "object" && "digest" in error) {
      const digest = String(error.digest);
      if (digest === "NEXT_NOT_FOUND" || // legacy compat
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;") || digest.startsWith("NEXT_REDIRECT;")) {
        throw error;
      }
    }
    return { error };
  }
  reset = () => {
    this.setState({ error: null });
  };
  render() {
    if (this.state.error) {
      const FallbackComponent = this.props.fallback;
      return jsx(FallbackComponent, { error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
class NotFoundBoundaryInner extends React__default.Component {
  constructor(props) {
    super(props);
    this.state = { notFound: false, previousPathname: props.pathname };
  }
  static getDerivedStateFromProps(props, state) {
    if (props.pathname !== state.previousPathname && state.notFound) {
      return { notFound: false, previousPathname: props.pathname };
    }
    return { notFound: state.notFound, previousPathname: props.pathname };
  }
  static getDerivedStateFromError(error) {
    if (error && typeof error === "object" && "digest" in error) {
      const digest = String(error.digest);
      if (digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) {
        return { notFound: true };
      }
    }
    throw error;
  }
  render() {
    if (this.state.notFound) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
function NotFoundBoundary({ fallback, children }) {
  const pathname = usePathname();
  return jsx(NotFoundBoundaryInner, { pathname, fallback, children });
}
function LayoutSegmentProvider({ depth, children }) {
  const ctx = getLayoutSegmentContext();
  if (!ctx) {
    return children;
  }
  return createElement(ctx.Provider, { value: depth }, children);
}
const export_6efdf509a785 = {
  default: Page
};
const export_f29e6e234fea = {
  ErrorBoundary,
  NotFoundBoundary
};
const export_0deffcb8ffd7 = {
  LayoutSegmentProvider
};
export {
  export_0deffcb8ffd7,
  export_6efdf509a785,
  export_f29e6e234fea
};
