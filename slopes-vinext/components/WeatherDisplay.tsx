"use client";

import React from "react";
import { latestWeather, isWeatherStale, weatherTimeParts } from "../../weather-data.mjs";
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
  const metrics = [
    ['temperature', 'temperature', 'bi bi-thermometer-half', '°C', 1],
    ['humidity', 'humidity', 'bi bi-moisture', '%', 0],
    ['wind_speed', 'wind-speed', 'bi bi-wind', 'm/s', 1],
    ['rainfall', 'rainfall', 'bi bi-droplet-fill', 'mm', 1],
    ['snowfall_3hr', 'snowfall', 'bi bi-snow', 'cm', 1],
  ] as const;
  return (
    <div className="weather-data">
      {metrics.filter(([field]) => data[field] !== null).map(([field, className, icon, unit, decimals], index) => (
        <React.Fragment key={field}>
          {index > 0 && <span> • </span>}
          <WeatherMetric className={className} icon={icon} value={data[field]!} unit={unit} decimals={decimals} />
        </React.Fragment>
      ))}
    </div>
  );
}

function WeatherTime({ time, source }: { time: string; source?: string }) {
  const { t } = useI18n();
  return <span className="weather-update-time">
    {t('weather.updateTime', weatherTimeParts(time))}
    {source && ` (${source})`}
    {isWeatherStale({ time }) && ` • ${t('weather.stale')}`}
  </span>;
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
        const mostRecent = latestWeather(locationData);
        if (!mostRecent) return null;

        let displayName = locationData.name;
        if (displayName.startsWith("리조트_")) {
          displayName = getWeatherLocationName(displayName.replace("리조트_", ""));
        } else {
          displayName = getWeatherLocationName(displayName);
        }


        return (
          <div key={`${locationData.resort}-${locationData.name}`} className="weather-info-wrapper">
            <div className="weather-info">
              <div className="location-name">
                {displayName}
                <WeatherTime time={mostRecent.time} source={showSource ? t(locationData.name.startsWith('리조트_') ? 'weather.resortProvided' : 'weather.kmaProvided') : undefined} />
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
    const basePoint = latestWeather(baseWeather);
    if (basePoint) {
      const mostRecent = basePoint;
      kmaEntries.push({
        resortId: resort.id,
        displayName: getResortNameI18n(resort.id, resort.name),
        data: mostRecent,
        timestamp: mostRecent.time,
      });
    }

    const resortProvided = weatherData.filter(w => w.resort === resort.name && w.name.startsWith("리조트_"));
    for (const rp of resortProvided) {
      const mostRecent = latestWeather(rp);
      if (mostRecent) {
        const locName = rp.name.replace("리조트_", "");
        resortEntries.push({
          resortId: resort.id,
          displayName: getWeatherLocationName(locName),
          data: mostRecent,
          timestamp: mostRecent.time,
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
                  <span className="location-name">{entry.displayName}<WeatherTime time={entry.timestamp} /></span>
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
                  <span className="location-name">{entry.displayName}<WeatherTime time={entry.timestamp} /></span>
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
