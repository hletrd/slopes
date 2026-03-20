"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { ForecastLocation } from "@/lib/types";

declare const Chart: any;

export function ForecastView() {
  const { t } = useI18n();
  const [forecasts, setForecasts] = useState<ForecastLocation[]>([]);
  const chartsRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}forecast.json?v=${Date.now()}`);
        if (res.ok) {
          const data = (await res.json()) as ForecastLocation[];
          setForecasts(data);
        }
      } catch {
        // Forecast data may not be available
      }
    })();

    return () => {
      // Cleanup charts
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
              label: t("weather.temperature") || "Temperature (°C)",
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
  }, [forecasts, t]);

  if (!forecasts.length) {
    return (
      <div className="content-section active">
        <h2>{t("nav.forecast") || "Forecast"}</h2>
        <p>{t("weather.noForecast") || "Loading forecast data..."}</p>
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
                  {t("weather.updated") || "Updated"}: {forecast.update_time}
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
}
