"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useFavorites } from "@/hooks/useFavorites";
import { useQuadView } from "@/hooks/useQuadView";
import { useI18n } from "@/lib/i18n";
import { getResortWebcams } from "@/lib/utils";
import type { Resort, WeatherLocation } from "@/lib/types";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WeatherDisplay, AllResortsWeather } from "@/components/WeatherDisplay";
import { ForecastView } from "@/components/ForecastView";

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
// Sub-components (structural stubs — full implementation lives in dedicated
// component files; these are inline placeholders so App compiles stand-alone)
// ---------------------------------------------------------------------------

interface MobileNavProps {
  onToggleSidebar: () => void;
}

function MobileNav({ onToggleSidebar }: MobileNavProps) {
  return (
    <div className="mobile-nav">
      <div className="mobile-nav-inner">
        <button className="toggle-menu btn" onClick={onToggleSidebar}>
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
  return (
    <button id="infoButton" className="info-button" onClick={onClick}>
      <i className="bi bi-file-earmark-text" />
    </button>
  );
}

interface FloatingButtonsProps {
  onSettings: () => void;
  onQuadView: () => void;
  onAddToHome: () => void;
}

function FloatingButtons({
  onSettings,
  onQuadView,
  onAddToHome,
}: FloatingButtonsProps) {
  return (
    <div className="floating-button-group">
      <button
        id="addToHomeButton"
        className="add-to-home"
        title="홈 화면에 추가"
        onClick={onAddToHome}
      >
        <i className="bi bi-house-add" />
      </button>
      <button
        id="settingsButton"
        className="settings-button"
        onClick={onSettings}
      >
        <i className="bi bi-gear" />
      </button>
      <button
        id="quadViewButton"
        className="quad-view-button"
        title="4분할 모드"
        aria-label="4분할 모드"
        onClick={onQuadView}
      >
        <i className="bi bi-border-all" />
      </button>
    </div>
  );
}

// Info Modal
interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

function InfoModal({ open, onClose }: InfoModalProps) {
  if (!open) return null;
  return (
    <div
      id="infoModal"
      className="info-modal"
      style={{ display: "flex" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="info-content">
        <button className="info-close" onClick={onClose}>
          <i className="bi bi-x" />
        </button>
        <h4 className="info-title">Slopes cam</h4>
        <div className="info-text">
          <p>Q. 일부 영상이 재생되지 않거나 오류가 있습니다.</p>
          <p>
            A. 각 영상은 스키장에서 제공하는 실시간 웹캠 영상으로, 본
            웹사이트는 영상을 저장하거나 재전송하지 않고 단순히 원본 영상의
            링크만을 연결합니다.
          </p>
          <ul>
            <li>
              스키장에 따라 영상 제공 방식이 상이하므로 재생 방식이 다를 수
              있습니다.
            </li>
            <li>
              스키장의 사정에 따라 영상이 제공되지 않거나 변경될 수 있습니다.
            </li>
            <li>
              스키장의 사정에 의해 영상이 일시적으로, 또는 영구적으로 서비스
              중단될 수 있습니다.
            </li>
            <li>
              모바일에서는 동시에 재생 가능한 영상의 수에 제한이 있을 수
              있으며, 전체보기가 되지 않을 수 있습니다.
            </li>
          </ul>
          <p>Q. 날씨 정보가 정확하지 않습니다.</p>
          <p>
            A. 날씨 정보는 실시간 관측 정보를 바탕으로 3차원 모델을 통해
            계산된 정보입니다. 날씨 정보는{" "}
            <a href="https://apihub.kma.go.kr/" target="_blank" rel="noreferrer">
              기상청 API허브
            </a>
            에서 제공하는 융합기상 데이터를 공공누리 제1유형 라이센스로
            사용하고 있습니다.
          </p>
          <ul>
            <li>
              날씨 정보는 국지적인 정보를 정확히 반영하지 않을 수 있으며,
              부정확한 정보를 포함할 수 있습니다.
            </li>
            <li>
              풍속은 10분 풍속, 강수량은 1시간 강수량이며, 적설량은 3시간
              적설량입니다.
            </li>
          </ul>
          <p>Q. 왜 만든 건가요?</p>
          <p>
            A. 스키장 영상과 날씨를 바로 모아볼 수 있는 페이지가 없어서
            만들었습니다.
          </p>
          <ul>
            <li>
              스키장 공식 홈페이지에서 제공하는 영상은 모바일에서 보기가
              불편했습니다.
            </li>
            <li>
              <a
                target="_blank"
                href="https://ski-resort.kr/"
                rel="noreferrer"
              >
                ski-resort.kr
              </a>
              와{" "}
              <a
                target="_blank"
                href="https://paulkim-xr.github.io/SkiWatch/"
                rel="noreferrer"
              >
                SkiWatch
              </a>
              도 참고했습니다만, 원하는 영상을 모아볼 수 있는 기능이 없고
              비발디파크를 제대로 지원하지 않아 직접 만들었습니다.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

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

function SettingsModal({
  open,
  onClose,
  autoplay,
  darkMode,
  language,
  onAutoplayChange,
  onDarkModeChange,
  onLanguageChange,
}: SettingsModalProps) {
  if (!open) return null;
  return (
    <div
      id="settingsModal"
      className="settings-modal"
      style={{ display: "block" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-content">
        <button className="settings-close" onClick={onClose}>
          <i className="bi bi-x" />
        </button>
        <h4 className="settings-title">설정</h4>
        <div className="settings-options">
          <div className="setting-item">
            <label htmlFor="autoplayToggle">동영상 자동 재생</label>
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
            <label htmlFor="themeToggle">다크 모드</label>
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
            <label htmlFor="languageSelect">언어</label>
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
}

// Bug Report Modal
interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
}

function BugReportModal({ open, onClose }: BugReportModalProps) {
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // reCAPTCHA + submit logic would go here
      await new Promise((r) => setTimeout(r, 500));
      setTitle("");
      setContent("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div
      id="bugReportModal"
      className="bug-report-modal active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bug-report-content">
        <button className="bug-report-close" onClick={onClose}>
          <i className="bi bi-x" />
        </button>
        <h4 className="bug-report-title">문의</h4>
        <form id="bugReportForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reportType">유형</label>
            <select
              id="reportType"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="bug">버그 신고</option>
              <option value="feature">기능 제안</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="reportTitle">제목</label>
            <input
              type="text"
              id="reportTitle"
              required
              maxLength={100}
              placeholder="제목을 입력해주세요. (최대 100자)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="reportContent">내용</label>
            <textarea
              id="reportContent"
              rows={5}
              required
              maxLength={1000}
              placeholder="내용을 입력해주세요. (최대 1000자)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            보내기
          </button>
        </form>
      </div>
    </div>
  );
}

// Installation Modal
interface InstallationModalProps {
  open: boolean;
  onClose: () => void;
}

function InstallationModal({ open, onClose }: InstallationModalProps) {
  return (
    <div
      id="installationModal"
      className={`installation-modal${open ? " active" : ""}`}
    >
      <button className="modal-close" onClick={onClose}>
        <i className="bi bi-x" />
      </button>
      <h4>홈 화면에 추가</h4>
      <div className="installation-steps">
        <div id="iOSInstructions">
          <p>
            <strong>iPhone</strong>
          </p>
          <ol>
            <li>
              Safari 브라우저에서 공유 버튼{" "}
              <i className="bi bi-box-arrow-up" /> 탭
            </li>
            <li>&quot;홈 화면에 추가&quot; 선택</li>
            <li>&quot;추가&quot; 버튼 탭</li>
          </ol>
        </div>
        <div id="androidInstructions">
          <p>
            <strong>Android</strong>
          </p>
          <ol>
            <li>
              Chrome 메뉴 <i className="bi bi-three-dots-vertical" /> 탭
            </li>
            <li>&quot;앱 설치&quot; 또는 &quot;홈 화면에 추가&quot; 선택</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

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
          title={t("buttons.back") || "돌아가기"}
          onClick={onClose}
        >
          <i className="bi bi-arrow-left" />
        </button>
        <button
          id="quadAddToHomeButton"
          className="quad-page-add-home"
          title={t("buttons.addToHome") || "홈 화면에 추가"}
          onClick={onAddToHome}
        >
          <i className="bi bi-house-add" />
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
                >
                  <option value="">{t("camera.select") || "카메라 선택"}</option>
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

function Sidebar({
  resorts,
  activeResortId,
  activeWebcamIndex,
  sidebarOpen,
  onResortClick,
  onWebcamClick,
}: SidebarProps) {
  const { t, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();

  return (
    <div className={`sidebar${sidebarOpen ? " active" : ""}`}>
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
              onClick={() => onResortClick(resort.id)}
            >
              {getResortNameI18n(resort.id, resort.name)}
            </div>
            {webcams.length > 0 && (
              <div className={`submenu${isActive ? " active" : ""}`}>
                {webcams.map((wc, idx) => (
                  <div
                    key={idx}
                    className={`submenu-item${isActive && activeWebcamIndex === idx ? " active" : ""}`}
                    onClick={() => onWebcamClick(resort.id, idx)}
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
          onClick={() => {
            window.location.hash = "misc/forecast";
          }}
        >
          {t("nav.forecast") || "예보"}
        </div>
      </div>
    </div>
  );
}

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
        <h2>{t("site.heroTitle") || "전국 스키장 실시간 웹캠 모음"}</h2>
        <p className="lead" style={{ fontSize: "1.1rem" }}>
          {t("site.heroSubtitle") || "왼쪽 메뉴에서 스키장 또는 카메라를 선택하세요."}
        </p>
        <p className="disclaimer mt-2" style={{ fontSize: "0.8rem" }}>
          <span>{t("site.disclaimer") || "사이트 오류 제보, 문의 및 기능 제안"}</span>
          <button className="bug-report-link" onClick={onBugReport}>
            {t("buttons.bugReport") || "버그 제보"}
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
                  <i className="bi bi-grip-vertical" />
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveFavorite(fav.resortId, fav.webcamIndex);
                    }}
                  >
                    <i className="bi bi-trash" />
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
function Footer() {
  return (
    <div className="footer">
      이 서비스는 스키장에서 공식적으로 제공하는 서비스가 아닙니다. 관련하여
      스키장에 문의하지 마세요.
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
  const { language, setLanguage, getResortName: getResortNameI18n, getWebcamName: getWebcamNameI18n } = useI18n();

  const [resorts, setResorts] = useState<Resort[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherLocation[]>([]);
  const [activeResortId, setActiveResortId] = useState<string | null>(null);
  const [activeWebcamIndex, setActiveWebcamIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Fetch resort and weather data
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}links.json`);
        if (res.ok) {
          const data = (await res.json()) as Resort[];
          setResorts(data);
        }
      } catch (e) {
        console.error("Failed to fetch links.json", e);
      }
    })();

    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}weather.json`);
        if (res.ok) {
          const data = (await res.json()) as WeatherLocation[];
          setWeatherData(data);
        }
      } catch {
        // Silently ignore if weather data is not available
      }
    })();
  }, []);

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
    setInstallationOpen(true);
  }, []);

  // Determine what main content to show
  const showHome = !activeResortId;
  const showForecast = activeResortId === "misc";
  const activeResort = resorts.find((r) => r.id === activeResortId) ?? null;

  return (
    <>
      <MobileNav onToggleSidebar={handleToggleSidebar} />

      <InfoButton onClick={() => setInfoOpen(true)} />

      <FloatingButtons
        onSettings={() => setSettingsOpen(true)}
        onQuadView={handleQuadOpen}
        onAddToHome={handleAddToHome}
      />

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
      <div className="main-content">
        {showHome && (
          <HomeContent
            onBugReport={() => setBugReportOpen(true)}
            weatherData={weatherData}
            resorts={resorts}
            favorites={favorites}
            onRemoveFavorite={(resortId, webcamIndex) => {
              const resort = resorts.find(r => r.id === resortId);
              const webcams = getResortWebcams(resort!);
              const wc = webcams[webcamIndex];
              if (wc) {
                toggleFavorite(resortId, webcamIndex, wc.name, resort?.name ?? "", wc.video || wc.link || "", wc.video_type);
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
