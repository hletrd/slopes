"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useFavorites } from "@/hooks/useFavorites";
import { useQuadView } from "@/hooks/useQuadView";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useI18n } from "@/lib/i18n";
import { getResortWebcams } from "@/lib/utils";
import type { Resort, WeatherLocation } from "@/lib/types";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WeatherDisplay, AllResortsWeather } from "@/components/WeatherDisplay";
import { ForecastView } from "@/components/ForecastView";

declare const grecaptcha: any;

// ---------------------------------------------------------------------------
// Hash routing helpers
// ---------------------------------------------------------------------------

type AppRoute =
  | { kind: "home" }
  | { kind: "resort"; resortId: string }
  | { kind: "webcam"; resortId: string; webcamIndex: number }
  | { kind: "quad" }
  | { kind: "forecast" };

function parseHash(hash: string): AppRoute {
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

function routeToHash(route: AppRoute): string {
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

// ---------------------------------------------------------------------------
// Focus trap helper for modals
// ---------------------------------------------------------------------------

function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement;
    const el = ref.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return ref;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MobileNavProps {
  onToggleSidebar: () => void;
}

function MobileNav({ onToggleSidebar }: MobileNavProps) {
  const { t } = useI18n();
  return (
    <div className="mobile-nav">
      <div className="mobile-nav-inner">
        <button className="toggle-menu btn" onClick={onToggleSidebar} aria-label={t("nav.selectFromMenu") || "Toggle menu"}>
          &#9776;
        </button>
        <div className="mobile-title">
          <a href="./">Slopes cam</a>
        </div>
        <div style={{ width: 24 }} />
      </div>
    </div>
  );
}

interface InfoButtonProps {
  onClick: () => void;
}

function InfoButton({ onClick }: InfoButtonProps) {
  const { t } = useI18n();
  return (
    <button id="infoButton" className="info-button" onClick={onClick} aria-label={t("info.q1") ? "Info" : "Info"}>
      <i className="bi bi-file-earmark-text" aria-hidden="true" />
    </button>
  );
}

interface FloatingButtonsProps {
  onSettings: () => void;
  onQuadView: () => void;
  onAddToHome: () => void;
}

const FloatingButtons = React.memo(function FloatingButtons({
  onSettings,
  onQuadView,
  onAddToHome,
}: FloatingButtonsProps) {
  const { t } = useI18n();
  return (
    <div className="floating-button-group">
      <button
        id="addToHomeButton"
        className="add-to-home"
        title={t("buttons.addToHome") || "Add to Home Screen"}
        aria-label={t("buttons.addToHome") || "Add to Home Screen"}
        onClick={onAddToHome}
      >
        <i className="bi bi-house-add" aria-hidden="true" />
      </button>
      <button
        id="settingsButton"
        className="settings-button"
        onClick={onSettings}
        aria-label={t("settings.title") || "Settings"}
        title={t("settings.title") || "Settings"}
      >
        <i className="bi bi-gear" aria-hidden="true" />
      </button>
      <button
        id="quadViewButton"
        className="quad-view-button"
        title={t("buttons.quadView") || "Quad View"}
        aria-label={t("buttons.quadView") || "Quad View"}
        onClick={onQuadView}
      >
        <i className="bi bi-border-all" aria-hidden="true" />
      </button>
    </div>
  );
});

// Info Modal
interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

const InfoModal = React.memo(function InfoModal({ open, onClose }: InfoModalProps) {
  const { t } = useI18n();
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id="infoModal"
      className="info-modal"
      style={{ display: "flex" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="info-content" ref={trapRef}>
        <button className="info-close" onClick={onClose} aria-label={t("buttons.back") || "Close"}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
        <h4 className="info-title" id="info-modal-title">Slopes cam</h4>
        <div className="info-text">
          <p>{t("info.q1")}</p>
          <p>{t("info.a1")}</p>
          <ul>
            <li>{t("info.a1_1")}</li>
            <li>{t("info.a1_2")}</li>
            <li>{t("info.a1_3")}</li>
            <li>{t("info.a1_4")}</li>
          </ul>
          <p>{t("info.q2")}</p>
          <p dangerouslySetInnerHTML={{ __html: t("info.a2") }} />
          <ul>
            <li>{t("info.a2_1")}</li>
            <li>{t("info.a2_2")}</li>
          </ul>
          <p>{t("info.q3")}</p>
          <p>{t("info.a3")}</p>
          <ul>
            <li>{t("info.a3_1")}</li>
            <li dangerouslySetInnerHTML={{ __html: t("info.a3_2") }} />
          </ul>
        </div>
      </div>
    </div>
  );
});

// Settings Modal
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  autoplay: boolean;
  darkMode: boolean;
  language: string;
  onAutoplayChange: (v: boolean) => void;
  onDarkModeChange: (v: boolean) => void;
  onLanguageChange: (v: string) => void;
}

const SettingsModal = React.memo(function SettingsModal({
  open,
  onClose,
  autoplay,
  darkMode,
  language,
  onAutoplayChange,
  onDarkModeChange,
  onLanguageChange,
}: SettingsModalProps) {
  const { t } = useI18n();
  const trapRef = useFocusTrap(open);

  if (!open) return null;
  return (
    <div
      id="settingsModal"
      className="settings-modal"
      style={{ display: "block" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-content" ref={trapRef}>
        <button className="settings-close" onClick={onClose} aria-label={t("buttons.back") || "Close"}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
        <h4 className="settings-title" id="settings-modal-title">{t("settings.title") || "Settings"}</h4>
        <div className="settings-options">
          <div className="setting-item">
            <label htmlFor="autoplayToggle">{t("settings.autoplay") || "Auto-play videos"}</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="autoplayToggle"
                checked={autoplay}
                onChange={(e) => onAutoplayChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </div>
          </div>
          <div className="setting-item">
            <label htmlFor="themeToggle">{t("settings.darkMode") || "Dark mode"}</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="themeToggle"
                checked={darkMode}
                onChange={(e) => onDarkModeChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </div>
          </div>
          <div className="setting-item">
            <label htmlFor="languageSelect">{t("settings.language") || "Language"}</label>
            <select
              id="languageSelect"
              className="language-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
});

// Bug Report Modal
interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
}

const BugReportModal = React.memo(function BugReportModal({ open, onClose }: BugReportModalProps) {
  const { t } = useI18n();
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trapRef = useFocusTrap(open);

  const showToast = useCallback((message: string, type: string = "success") => {
    const toast = document.createElement("div");
    toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 toast-message`;
    toast.style.zIndex = "10001";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 500);
    }, 2000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (typeof grecaptcha === "undefined") {
        showToast(t("bugReport.captchaRequired") || "CAPTCHA required", "warning");
        return;
      }
      const token = await grecaptcha.execute("6LdnzyUsAAAAAKh6eSEaERifPRTh51qnRnpmX6S0", { action: "submit" });
      const res = await fetch("/report.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          content,
          recaptchaToken: token,
        }),
      });
      if (res.ok) {
        showToast(t("bugReport.success") || "Submitted successfully.", "success");
        setTitle("");
        setContent("");
        onClose();
      } else {
        showToast(t("bugReport.submitFailed") || "Submission failed", "danger");
      }
    } catch {
      showToast(t("bugReport.submitError") || "An error occurred while submitting.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div
      id="bugReportModal"
      className="bug-report-modal active"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bugreport-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bug-report-content" ref={trapRef}>
        <button className="bug-report-close" onClick={onClose} aria-label={t("buttons.back") || "Close"}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
        <h4 className="bug-report-title" id="bugreport-modal-title">{t("bugReport.title") || "Contact"}</h4>
        <form id="bugReportForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reportType">{t("bugReport.type") || "Type"}</label>
            <select
              id="reportType"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="bug">{t("bugReport.typeBug") || "Bug Report"}</option>
              <option value="feature">{t("bugReport.typeFeature") || "Feature Request"}</option>
              <option value="other">{t("bugReport.typeOther") || "Other"}</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="reportTitle">{t("bugReport.titleLabel") || "Title"}</label>
            <input
              type="text"
              id="reportTitle"
              required
              maxLength={100}
              placeholder={t("bugReport.titlePlaceholder") || "Enter a title. (Max 100 characters)"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="reportContent">{t("bugReport.content") || "Content"}</label>
            <textarea
              id="reportContent"
              rows={5}
              required
              maxLength={1000}
              placeholder={t("bugReport.contentPlaceholder") || "Enter your message. (Max 1000 characters)"}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? (t("bugReport.submitting") || "Submitting...") : (t("bugReport.submit") || "Submit")}
          </button>
        </form>
      </div>
    </div>
  );
});

// Installation Modal
interface InstallationModalProps {
  open: boolean;
  onClose: () => void;
}

const InstallationModal = React.memo(function InstallationModal({ open, onClose }: InstallationModalProps) {
  const { t } = useI18n();
  const trapRef = useFocusTrap(open);

  return (
    <div
      id="installationModal"
      className={`installation-modal${open ? " active" : ""}`}
      role="dialog"
      aria-modal={open ? "true" : undefined}
      aria-labelledby="installation-modal-title"
    >
      <div ref={trapRef}>
        <button className="modal-close" onClick={onClose} aria-label={t("buttons.back") || "Close"}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
        <h4 id="installation-modal-title">{t("installation.title") || "Add to Home Screen"}</h4>
        <div className="installation-steps">
          <div id="iOSInstructions">
            <p>
              <strong>{t("installation.iphone") || "iPhone"}</strong>
            </p>
            <ol>
              <li dangerouslySetInnerHTML={{ __html: t("installation.iphoneStep1") || 'Tap the Share button <i class="bi bi-box-arrow-up"></i> in Safari' }} />
              <li>{t("installation.iphoneStep2") || '"Add to Home Screen"'}</li>
              <li>{t("installation.iphoneStep3") || 'Tap "Add"'}</li>
            </ol>
          </div>
          <div id="androidInstructions">
            <p>
              <strong>{t("installation.android") || "Android"}</strong>
            </p>
            <ol>
              <li dangerouslySetInnerHTML={{ __html: t("installation.androidStep1") || 'Tap the Chrome menu <i class="bi bi-three-dots-vertical"></i>' }} />
              <li>{t("installation.androidStep2") || '"Install app" or "Add to Home screen"'}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
});

// Quad View
interface QuadViewProps {
  open: boolean;
  resorts: Resort[];
  selections: string[];
  onSelectionChange: (slot: number, value: string) => void;
  onClose: () => void;
  onAddToHome: () => void;
  darkMode: boolean;
  autoplay: boolean;
}

function QuadView({
  open,
  resorts,
  selections,
  onSelectionChange,
  onClose,
  onAddToHome,
  darkMode,
  autoplay,
}: QuadViewProps) {
  const { t, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();

  if (!open) return null;

  function getSlotWebcam(value: string) {
    if (!value) return null;
    const [resortId, idxStr] = value.split("/");
    const webcamIndex = parseInt(idxStr, 10);
    const resort = resorts.find(r => r.id === resortId);
    if (!resort || isNaN(webcamIndex)) return null;
    const webcams = getResortWebcams(resort);
    const wc = webcams[webcamIndex];
    if (!wc) return null;
    return { resort, wc, webcamIndex };
  }

  return (
    <div id="quadViewContainer" className="quad-view-container active">
      <div
        id="quadViewPage"
        className={`quad-page${!darkMode ? " light-mode" : ""}`}
      >
        <button
          id="quadBackButton"
          className="quad-page-back"
          title={t("buttons.back") || "Back"}
          aria-label={t("buttons.back") || "Back"}
          onClick={onClose}
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <button
          id="quadAddToHomeButton"
          className="quad-page-add-home"
          title={t("buttons.addToHome") || "Add to Home Screen"}
          aria-label={t("buttons.addToHome") || "Add to Home Screen"}
          onClick={onAddToHome}
        >
          <i className="bi bi-house-add" aria-hidden="true" />
        </button>
        <div className="quad-grid">
          {[0, 1, 2, 3].map((slot) => {
            const slotData = getSlotWebcam(selections[slot] ?? "");
            return (
              <div key={slot} className="quad-slot">
                <select
                  className="quad-select"
                  value={selections[slot] ?? ""}
                  onChange={(e) => onSelectionChange(slot, e.target.value)}
                  aria-label={`${t("camera.select") || "Camera"} ${slot + 1}`}
                >
                  <option value="">{t("camera.select") || "Select Camera"}</option>
                  {resorts.map((resort) => {
                    const webcams = getResortWebcams(resort);
                    if (!webcams.length) return null;
                    return (
                      <optgroup key={resort.id} label={getResortNameI18n(resort.id, resort.name)}>
                        {webcams.map((wc, idx) => (
                          <option key={idx} value={`${resort.id}/${idx}`}>
                            {getWebcamNameI18n(resort.id, idx, wc.name)}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <div className="quad-video">
                  {slotData && (
                    <VideoPlayer
                      webcam={slotData.wc}
                      playerId={`quad-${slotData.resort.id}-${slotData.webcamIndex}`}
                      autoplay={autoplay}
                      resortName={slotData.resort.name}
                      webcamName={slotData.wc.name}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Sidebar
interface SidebarProps {
  resorts: Resort[];
  activeResortId: string | null;
  activeWebcamIndex: number | null;
  sidebarOpen: boolean;
  onResortClick: (resortId: string) => void;
  onWebcamClick: (resortId: string, webcamIndex: number) => void;
}

const Sidebar = React.memo(function Sidebar({
  resorts,
  activeResortId,
  activeWebcamIndex,
  sidebarOpen,
  onResortClick,
  onWebcamClick,
}: SidebarProps) {
  const { t, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  }, []);

  return (
    <nav className={`sidebar${sidebarOpen ? " active" : ""}`} aria-label="Resort navigation">
      <div className="site-title">
        <a href="./">Slopes cam</a>
      </div>
      {resorts.map((resort) => {
        const webcams = getResortWebcams(resort);
        const isActive = activeResortId === resort.id;
        return (
          <div key={resort.id} className="menu-item-container">
            <div
              className={`menu-item${isActive && activeWebcamIndex === null ? " active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onResortClick(resort.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onResortClick(resort.id))}
            >
              {getResortNameI18n(resort.id, resort.name)}
            </div>
            {webcams.length > 0 && (
              <div className={`submenu${isActive ? " active" : ""}`}>
                {webcams.map((wc, idx) => (
                  <div
                    key={idx}
                    className={`submenu-item${isActive && activeWebcamIndex === idx ? " active" : ""}`}
                    role="button"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onWebcamClick(resort.id, idx)}
                    onKeyDown={(e) => handleKeyDown(e, () => onWebcamClick(resort.id, idx))}
                  >
                    {getWebcamNameI18n(resort.id, idx, wc.name)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {/* Forecast link */}
      <div className="menu-item-container">
        <div
          className="menu-item"
          role="button"
          tabIndex={0}
          onClick={() => { window.location.hash = "misc/forecast"; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.location.hash = "misc/forecast";
            }
          }}
        >
          {t("nav.forecast") || "Forecast"}
        </div>
      </div>
    </nav>
  );
});

// Default home content
interface HomeContentProps {
  onBugReport: () => void;
  weatherData: WeatherLocation[];
  resorts: Resort[];
  favorites: import("@/lib/types").FavoriteItem[];
  onRemoveFavorite: (resortId: string, webcamIndex: number) => void;
  onReorderFavorites: (fromIndex: number, toIndex: number) => void;
  autoplay: boolean;
}

function HomeContent({
  onBugReport,
  weatherData,
  resorts,
  favorites,
  onRemoveFavorite,
  onReorderFavorites,
  autoplay,
}: HomeContentProps) {
  const { t } = useI18n();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div
      id="default-message"
      className="content-section content-section-default active"
    >
      <div className="text-center p-4">
        <h2>{t("home.title") || "Live Ski Resort Webcams"}</h2>
        <p className="lead" style={{ fontSize: "1.1rem" }}>
          {t("nav.selectResort") || "Select a ski resort or camera from the menu on the left."}
        </p>
        <p className="disclaimer mt-2" style={{ fontSize: "0.8rem" }}>
          <span>{t("home.issueReport") || "Report issues, inquiries, and feature suggestions"}</span>
          <button className="bug-report-link" onClick={onBugReport}>
            {t("buttons.bugReport") || "Report"}
          </button>
          <span className="github-button-issue">
            <a
              className="github-button github-button-issue"
              href="https://github.com/hletrd/slopes/issues"
              data-color-scheme="no-preference: dark; light: dark; dark: dark;"
              data-icon="octicon-issue-opened"
              aria-label="Issue hletrd/slopes on GitHub"
            >
              Issue
            </a>
          </span>
        </p>
        <p className="lead github-buttons">
          <a
            className="github-button"
            href="https://github.com/hletrd/slopes"
            data-color-scheme="no-preference: dark; light: dark; dark: dark;"
            data-icon="octicon-star"
            data-show-count="true"
            aria-label="Star hletrd/slopes on GitHub"
          >
            Star
          </a>{" "}
          <a
            className="github-button"
            href="https://github.com/hletrd"
            data-color-scheme="no-preference: dark; light: dark; dark: dark;"
            data-show-count="true"
            aria-label="Follow @hletrd on GitHub"
          >
            Follow @hletrd
          </a>
        </p>
      </div>

      {/* Favorites */}
      <div id="favorites-container" style={{ display: favorites.length > 0 ? "block" : "none" }}>
        <h3>{t("bookmarks.title") || "Bookmarks"}</h3>
        {favorites.length === 0 && (
          <div className="instruction">
            <p>{t("bookmarks.empty") || "No bookmarks yet."}<br />{t("bookmarks.browserOnly") || ""}</p>
          </div>
        )}
        <div id="favorites-grid" className="videos-grid">
          {favorites.map((fav, idx) => {
            const resort = resorts.find(r => r.id === fav.resortId);
            const webcams = resort ? getResortWebcams(resort) : [];
            const webcam = webcams[fav.webcamIndex];

            return (
              <div
                key={`${fav.resortId}-${fav.webcamIndex}`}
                className={`video-card favorite-card${dragIndex === idx ? " dragging" : ""}`}
                draggable
                data-index={idx}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== idx) {
                    onReorderFavorites(dragIndex, idx);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="drag-handle">
                  <i className="bi bi-grip-vertical" aria-hidden="true" />
                </div>
                <div className="favorites-header-container">
                  <div className="favorite-header">
                    <span
                      className="favorite-location cursor-pointer"
                      onClick={() => {
                        window.location.hash = `${fav.resortId}/${fav.webcamIndex}`;
                      }}
                    >
                      {fav.webcamName}
                    </span>
                    <span className="favorite-resort">{fav.resortName}</span>
                  </div>
                  <button
                    className="favorites-remove-button"
                    title={t("buttons.removeBookmark") || "Remove"}
                    aria-label={t("buttons.removeBookmark") || "Remove bookmark"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveFavorite(fav.resortId, fav.webcamIndex);
                    }}
                  >
                    <i className="bi bi-trash" aria-hidden="true" />
                  </button>
                </div>
                {webcam && fav.videoUrl && (
                  <VideoPlayer
                    webcam={{ ...webcam, video: fav.videoUrl, video_type: fav.videoType as any }}
                    playerId={`favorite-player-${idx}`}
                    autoplay={autoplay}
                    resortId={fav.resortId}
                    webcamIndex={fav.webcamIndex}
                    resortName={fav.resortName}
                    webcamName={fav.webcamName}
                  />
                )}
                {(!webcam || !fav.videoUrl) && fav.videoUrl && (
                  <VideoPlayer
                    webcam={{ name: fav.webcamName, video: fav.videoUrl, video_type: fav.videoType as any }}
                    playerId={`favorite-player-${idx}`}
                    autoplay={autoplay}
                    resortName={fav.resortName}
                    webcamName={fav.webcamName}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* All Resorts Weather */}
      <AllResortsWeather
        weatherData={weatherData}
        resortNames={resorts.map(r => ({ id: r.id, name: r.name }))}
      />
    </div>
  );
}

// Footer
const Footer = React.memo(function Footer() {
  const { t } = useI18n();
  return (
    <div className="footer">
      {t("footer.disclaimer") || "This service is not officially provided by ski resorts. Please do not contact resorts regarding this service."}
    </div>
  );
});

// SW Update Toast
function UpdateToast({ onApply }: { onApply: () => void }) {
  const { t } = useI18n();
  return (
    <div className="alert alert-info position-fixed bottom-0 start-50 translate-middle-x mb-3 d-flex align-items-center gap-2" style={{ zIndex: 10000 }}>
      <span>{t("messages.updateAvailable") || "Update available"}</span>
      <button className="btn btn-sm btn-primary" onClick={onApply}>
        {t("buttons.retry") || "Apply"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------

export function App() {
  const { settings, updateSettings } = useSettings();
  const { favorites, isFavorite, toggleFavorite, reorderFavorites } = useFavorites();
  const { quadSelections, updateQuadSelection, isOpen: quadOpen, open: openQuad, close: closeQuad } = useQuadView();
  const { t, language, setLanguage, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const { canInstall, promptInstall, isStandalone } = usePWAInstall();

  const [resorts, setResorts] = useState<Resort[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherLocation[]>([]);
  const [activeResortId, setActiveResortId] = useState<string | null>(null);
  const [activeWebcamIndex, setActiveWebcamIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resortsLoading, setResortsLoading] = useState(true);
  const [resortsError, setResortsError] = useState(false);

  // Modal states
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [installationOpen, setInstallationOpen] = useState(false);

  // Apply quad-view-open class to body
  useEffect(() => {
    if (quadOpen) {
      document.body.classList.add("quad-view-open");
    } else {
      document.body.classList.remove("quad-view-open");
    }
  }, [quadOpen]);

  // Fetch resort data
  const fetchResorts = useCallback(() => {
    setResortsLoading(true);
    setResortsError(false);
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}links.json?v=${Date.now()}`);
        if (res.ok) {
          const data = (await res.json()) as Resort[];
          setResorts(data);
        } else {
          setResortsError(true);
        }
      } catch {
        setResortsError(true);
      } finally {
        setResortsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchResorts();

    // Fetch weather from root (shared data, not vinext-specific)
    void (async () => {
      try {
        const res = await fetch(`/weather.json?v=${Date.now()}`);
        if (res.ok) {
          const data = (await res.json()) as WeatherLocation[];
          setWeatherData(data);
        }
      } catch {
        // Silently ignore if weather data is not available
      }
    })();
  }, [fetchResorts]);

  // Update page title based on navigation
  useEffect(() => {
    const baseTitle = "Slopes cam";
    if (!activeResortId) {
      document.title = `${baseTitle} - 전국 스키장 실시간 웹캠 모음`;
      return;
    }
    if (activeResortId === "misc") {
      document.title = `${baseTitle} - 일기예보`;
      return;
    }
    const resort = resorts.find(r => r.id === activeResortId);
    if (resort) {
      const resortName = getResortNameI18n(resort.id, resort.name);
      if (activeWebcamIndex !== null) {
        const webcams = getResortWebcams(resort);
        const wc = webcams[activeWebcamIndex];
        if (wc) {
          const wcName = getWebcamNameI18n(resort.id, activeWebcamIndex, wc.name);
          document.title = `${wcName} - ${resortName} - ${baseTitle}`;
          return;
        }
      }
      document.title = `${resortName} - ${baseTitle}`;
    }
  }, [activeResortId, activeWebcamIndex, resorts, getResortNameI18n, getWebcamNameI18n]);

  // Hash routing
  const applyRoute = useCallback((route: AppRoute) => {
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
    // Read initial hash
    applyRoute(parseHash(window.location.hash));

    const onHashChange = () => {
      applyRoute(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyRoute]);

  // Navigation handlers that also update the URL hash
  const navigateToResort = useCallback((resortId: string) => {
    window.location.hash = routeToHash({ kind: "resort", resortId });
    setSidebarOpen(false);
  }, []);

  const navigateToWebcam = useCallback(
    (resortId: string, webcamIndex: number) => {
      window.location.hash = routeToHash({
        kind: "webcam",
        resortId,
        webcamIndex,
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
    if (canInstall) {
      promptInstall();
    } else {
      setInstallationOpen(true);
    }
  }, [canInstall, promptInstall]);

  // Determine what main content to show
  const showHome = !activeResortId;
  const showForecast = activeResortId === "misc";
  const activeResort = resorts.find((r) => r.id === activeResortId) ?? null;

  return (
    <>
      {/* Skip to content link */}
      <a href="#main-content" className="visually-hidden-focusable position-absolute" style={{ zIndex: 10001 }}>
        Skip to content
      </a>

      <MobileNav onToggleSidebar={handleToggleSidebar} />

      <InfoButton onClick={() => setInfoOpen(true)} />

      <FloatingButtons
        onSettings={() => setSettingsOpen(true)}
        onQuadView={handleQuadOpen}
        onAddToHome={handleAddToHome}
      />

      {/* SW Update Toast */}
      {updateAvailable && <UpdateToast onApply={applyUpdate} />}

      {/* Modals */}
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        autoplay={settings.autoplay}
        darkMode={settings.darkMode}
        language={language}
        onAutoplayChange={(v) => updateSettings({ autoplay: v })}
        onDarkModeChange={(v) => updateSettings({ darkMode: v })}
        onLanguageChange={(v) => setLanguage(v as "ko" | "en")}
      />
      <BugReportModal
        open={bugReportOpen}
        onClose={() => setBugReportOpen(false)}
      />
      <InstallationModal
        open={installationOpen}
        onClose={() => setInstallationOpen(false)}
      />

      {/* Quad View */}
      <QuadView
        open={quadOpen}
        resorts={resorts}
        selections={quadSelections}
        onSelectionChange={updateQuadSelection}
        onClose={handleQuadClose}
        onAddToHome={handleAddToHome}
        darkMode={settings.darkMode}
        autoplay={settings.autoplay}
      />

      {/* Sidebar backdrop */}
      <div
        className={`sidebar-backdrop${sidebarOpen ? " active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <Sidebar
        resorts={resorts}
        activeResortId={activeResortId}
        activeWebcamIndex={activeWebcamIndex}
        sidebarOpen={sidebarOpen}
        onResortClick={navigateToResort}
        onWebcamClick={navigateToWebcam}
      />

      {/* Main content */}
      <div className="main-content" id="main-content">
        {resortsLoading && showHome && (
          <div className="d-flex justify-content-center p-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}
        {resortsError && showHome && (
          <div className="content-section active text-center p-4">
            <p>{t("errors.loadFailed") || "Failed to load resort information."}</p>
            <button className="btn btn-secondary" onClick={fetchResorts}>
              <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
              {t("buttons.retry") || "Retry"}
            </button>
          </div>
        )}
        {!resortsLoading && !resortsError && showHome && (
          <HomeContent
            onBugReport={() => setBugReportOpen(true)}
            weatherData={weatherData}
            resorts={resorts}
            favorites={favorites}
            onRemoveFavorite={(resortId, webcamIndex) => {
              const resort = resorts.find(r => r.id === resortId);
              if (!resort) return;
              const webcams = getResortWebcams(resort);
              const wc = webcams[webcamIndex];
              if (wc) {
                toggleFavorite(resortId, webcamIndex, wc.name, resort.name, wc.video || wc.link || "", wc.video_type);
              }
            }}
            onReorderFavorites={reorderFavorites}
            autoplay={settings.autoplay}
          />
        )}
        {showForecast && <ForecastView />}
        {activeResort && !showForecast && (
          <div className="content-section active">
            <div className="page-header">
              <span className="inline-title">
                {getResortNameI18n(activeResort.id, activeResort.name)}
              </span>
            </div>
            {activeWebcamIndex !== null ? (() => {
              const webcams = getResortWebcams(activeResort);
              const wc = webcams[activeWebcamIndex];
              if (!wc) return <div className="error-message">Webcam not found</div>;
              const wcName = getWebcamNameI18n(activeResort.id, activeWebcamIndex, wc.name);
              const resName = getResortNameI18n(activeResort.id, activeResort.name);
              const videoUrl = wc.video || wc.link || "";
              const bookmarked = isFavorite(activeResort.id, activeWebcamIndex);
              return (
                <div>
                  <h3 className="inline-title inline-title-submenu">{wcName}</h3>
                  <VideoPlayer
                    webcam={wc}
                    playerId={`${activeResort.id}-${activeWebcamIndex}`}
                    autoplay={settings.autoplay}
                    resortId={activeResort.id}
                    webcamIndex={activeWebcamIndex}
                    resortName={resName}
                    webcamName={wcName}
                    isBookmarked={bookmarked}
                    onBookmark={() =>
                      toggleFavorite(
                        activeResort.id,
                        activeWebcamIndex!,
                        wcName,
                        resName,
                        videoUrl,
                        wc.video_type
                      )
                    }
                  />
                  <WeatherDisplay
                    weatherData={weatherData}
                    resortName={activeResort.name}
                  />
                </div>
              );
            })() : (
              <>
                <div className="videos-grid">
                  {getResortWebcams(activeResort).map((wc, idx) => {
                    const videoUrl = wc.video || wc.link || "";
                    if (!videoUrl) return null;
                    const wcName = getWebcamNameI18n(activeResort.id, idx, wc.name);
                    const resName = getResortNameI18n(activeResort.id, activeResort.name);
                    const bookmarked = isFavorite(activeResort.id, idx);
                    return (
                      <div key={idx} className="video-card">
                        <h3
                          className="cursor-pointer"
                          onClick={() => navigateToWebcam(activeResort.id, idx)}
                        >
                          {wcName}
                        </h3>
                        <VideoPlayer
                          webcam={wc}
                          playerId={`${activeResort.id}-grid-${idx}`}
                          autoplay={settings.autoplay}
                          resortId={activeResort.id}
                          webcamIndex={idx}
                          resortName={resName}
                          webcamName={wcName}
                          isBookmarked={bookmarked}
                          onBookmark={() =>
                            toggleFavorite(
                              activeResort.id,
                              idx,
                              wcName,
                              resName,
                              videoUrl,
                              wc.video_type
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
                <WeatherDisplay
                  weatherData={weatherData}
                  resortName={activeResort.name}
                />
              </>
            )}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
