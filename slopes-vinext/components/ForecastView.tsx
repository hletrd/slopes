"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { ForecastLocation } from "@/lib/types";

declare const Chart: any;

export const ForecastView = React.memo(function ForecastView() {
  const { t } = useI18n();
  const [forecasts, setForecasts] = useState<ForecastLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const chartsRef = useRef<Map<string, any>>(new Map());

  const fetchForecasts = () => {
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const res = await fetch(`/forecast.json?v=${Date.now()}`);
        if (res.ok) {
          const data = (await res.json()) as ForecastLocation[];
          setForecasts(data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    fetchForecasts();

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
    if (!forecasts.length) return;

    // Wait for Chart.js to load (CDN, deferred)
    let retryCount = 0;
    const maxRetries = 50;

    function tryRenderCharts() {
      if (typeof Chart === "undefined") {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(tryRenderCharts, 100);
        }
        return;
      }
      renderCharts();
    }

    function renderCharts() {
      // Destroy old charts before recreating
      for (const chart of chartsRef.current.values()) {
        if (chart && typeof chart.destroy === "function") {
          chart.destroy();
        }
      }
      chartsRef.current.clear();

      forecasts.forEach((forecast) => {
        const canvasId = `forecast-chart-${forecast.resort}-${forecast.name}`.replace(/\s+/g, "-");
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas || !forecast.data?.length) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const labels = forecast.data.map(d => d.time);
        const temps = forecast.data.map(d => d.temperature);
        const winds = forecast.data.map(d => d.wind_speed);
        const snows = forecast.data.map(d => d.snowfall_3hr);

        const isDark = document.documentElement.getAttribute("data-theme") !== "light";
        const textColor = isDark ? "#ccc" : "#333";
        const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

        const chart = new Chart(ctx, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: t("weather.temperature") || "Temperature",
                data: temps,
                borderColor: "#ff6384",
                backgroundColor: "rgba(255, 99, 132, 0.1)",
                yAxisID: "y",
                tension: 0.3,
              },
              {
                label: t("weather.windSpeed") || "Wind (m/s)",
                data: winds,
                borderColor: "#36a2eb",
                backgroundColor: "rgba(54, 162, 235, 0.1)",
                yAxisID: "y",
                tension: 0.3,
              },
              {
                label: t("weather.snowfall") || "Snow (cm/3hr)",
                data: snows,
                borderColor: "#4bc0c0",
                backgroundColor: "rgba(75, 192, 192, 0.3)",
                type: "bar",
                yAxisID: "y1",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
              x: {
                ticks: { color: textColor, maxRotation: 45 },
                grid: { color: gridColor },
              },
              y: {
                type: "linear",
                position: "left",
                ticks: { color: textColor },
                grid: { color: gridColor },
              },
              y1: {
                type: "linear",
                position: "right",
                min: 0,
                ticks: { color: textColor },
                grid: { drawOnChartArea: false },
              },
            },
            plugins: {
              legend: { labels: { color: textColor } },
            },
          },
        });

        chartsRef.current.set(canvasId, chart);
      });
    }

    tryRenderCharts();
  }, [forecasts, t]);

  if (loading) {
    return (
      <div className="content-section active">
        <h2>{t("nav.forecast") || "Forecast"}</h2>
        <div className="d-flex justify-content-center p-4">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-section active">
        <h2>{t("nav.forecast") || "Forecast"}</h2>
        <div className="text-center p-4">
          <p>{t("forecast.loadError") || "Failed to load forecast data."}</p>
          <button className="btn btn-secondary" onClick={fetchForecasts}>
            <i className="bi bi-arrow-clockwise me-2" />
            {t("buttons.retry") || "Retry"}
          </button>
        </div>
      </div>
    );
  }

  if (!forecasts.length) {
    return (
      <div className="content-section active">
        <h2>{t("nav.forecast") || "Forecast"}</h2>
        <p>{t("forecast.noData") || "No forecast data available."}</p>
      </div>
    );
  }

  return (
    <div className="content-section active">
      <h2>{t("nav.forecast") || "Forecast"}</h2>
      <div className="forecast-charts">
        {forecasts.map((forecast) => {
          const canvasId = `forecast-chart-${forecast.resort}-${forecast.name}`.replace(/\s+/g, "-");
          return (
            <div key={canvasId} className="forecast-chart-wrapper" style={{ marginBottom: 24 }}>
              <h4>{forecast.name}</h4>
              {forecast.update_time && (
                <p style={{ fontSize: "0.8em", color: "#999" }}>
                  {t("forecast.updateTime", { date: forecast.update_time.split(" ")[0] || "", time: forecast.update_time.split(" ")[1] || "" }) || `Updated: ${forecast.update_time}`}
                </p>
              )}
              <div style={{ height: 300 }}>
                <canvas id={canvasId} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
