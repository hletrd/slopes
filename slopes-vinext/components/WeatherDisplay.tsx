"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import type { WeatherLocation, WeatherDataPoint } from "@/lib/types";

interface WeatherMetricProps {
  className: string;
  icon: string;
  value: number;
  unit: string;
  decimals?: number;
}

function WeatherMetric({ className, icon, value, unit, decimals = 1 }: WeatherMetricProps) {
  return (
    <span className={className}>
      <i className={icon} />
      {Number(value).toFixed(decimals)}{unit}
    </span>
  );
}

function WeatherDataRow({ data }: { data: WeatherDataPoint }) {
  return (
    <div className="weather-data">
      {data.temperature !== null && (
        <WeatherMetric className="temperature" icon="bi bi-thermometer-half" value={data.temperature} unit="°C" />
      )}
      {data.humidity !== null && (
        <>
          <span> • </span>
          <WeatherMetric className="humidity" icon="bi bi-moisture" value={data.humidity} unit="%" decimals={0} />
        </>
      )}
      {data.wind_speed !== null && (
        <>
          <span> • </span>
          <WeatherMetric className="wind-speed" icon="bi bi-wind" value={data.wind_speed} unit="m/s" />
        </>
      )}
      {data.rainfall !== null && (
        <>
          <span> • </span>
          <WeatherMetric className="rainfall" icon="bi bi-droplet-fill" value={data.rainfall} unit="mm" />
        </>
      )}
      {data.snowfall_3hr !== null && (
        <>
          <span> • </span>
          <WeatherMetric className="snowfall" icon="bi bi-snow" value={data.snowfall_3hr} unit="cm" />
        </>
      )}
    </div>
  );
}

interface WeatherDisplayProps {
  weatherData: WeatherLocation[];
  resortName: string;
  showSource?: boolean;
}

export function WeatherDisplay({ weatherData, resortName, showSource = true }: WeatherDisplayProps) {
  const { t, getWeatherLocationName } = useI18n();

  const resortWeather = weatherData.filter(w => w.resort === resortName);
  if (resortWeather.length === 0) return null;

  return (
    <div className="weather-container">
      {resortWeather.map((locationData) => {
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

        return (
          <div key={`${locationData.resort}-${locationData.name}`} className="weather-info-wrapper">
            <div className="weather-info">
              <div className="location-name">
                {displayName}
                {timeStr && <span className="weather-update-time">{timeStr}</span>}
              </div>
              <WeatherDataRow data={mostRecent} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface AllResortsWeatherProps {
  weatherData: WeatherLocation[];
  resortNames: Array<{ id: string; name: string }>;
}

export function AllResortsWeather({ weatherData, resortNames }: AllResortsWeatherProps) {
  const { t, getResortName: getResortNameI18n, getWeatherLocationName } = useI18n();

  if (!weatherData.length || !resortNames.length) return null;

  // KMA data
  const kmaEntries: Array<{ resortId: string; displayName: string; data: WeatherDataPoint; timestamp: string }> = [];
  // Resort-provided data
  const resortEntries: Array<{ resortId: string; displayName: string; data: WeatherDataPoint; timestamp: string }> = [];

  for (const resort of resortNames) {
    const baseWeather = weatherData.find(w => w.resort === resort.name && w.name === "스키하우스");
    if (baseWeather?.data?.length) {
      const mostRecent = baseWeather.data[baseWeather.data.length - 1];
      kmaEntries.push({
        resortId: resort.id,
        displayName: getResortNameI18n(resort.id, resort.name),
        data: mostRecent,
        timestamp: baseWeather.timestamp,
      });
    }

    const resortProvided = weatherData.filter(w => w.resort === resort.name && w.name.startsWith("리조트_"));
    for (const rp of resortProvided) {
      if (rp?.data?.length) {
        const mostRecent = rp.data[rp.data.length - 1];
        const locName = rp.name.replace("리조트_", "");
        resortEntries.push({
          resortId: resort.id,
          displayName: getWeatherLocationName(locName),
          data: mostRecent,
          timestamp: rp.timestamp,
        });
      }
    }
  }

  if (!kmaEntries.length && !resortEntries.length) return null;

  return (
    <div className="all-resorts-weather">
      {kmaEntries.length > 0 && (
        <>
          <h3>
            {t("weather.allResortsTitle") || "Weather"}{" "}
            <span style={{ fontSize: "0.6em", fontWeight: "normal", color: "#999", marginLeft: 6 }}>
              {t("weather.kmaData") || "KMA data"}
            </span>
          </h3>
          <div className="weather-container">
            {kmaEntries.map((entry) => (
              <div key={`kma-${entry.resortId}`} className="weather-info-wrapper">
                <div className="weather-info">
                  <span className="location-name">{entry.displayName}</span>
                  <WeatherDataRow data={entry.data} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {resortEntries.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>
            {t("weather.allResortsTitle") || "Weather"}{" "}
            <span style={{ fontSize: "0.6em", fontWeight: "normal", color: "#999", marginLeft: 6 }}>
              {t("weather.resortData") || "Resort data"}
            </span>
          </h3>
          <div className="weather-container">
            {resortEntries.map((entry, idx) => (
              <div key={`resort-${entry.resortId}-${idx}`} className="weather-info-wrapper">
                <div className="weather-info">
                  <span className="location-name">{entry.displayName}</span>
                  <WeatherDataRow data={entry.data} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
