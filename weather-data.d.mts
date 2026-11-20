import type { WeatherLocation, WeatherDataPoint, ForecastLocation } from './slopes-vinext/lib/types';
export function weatherValue(field: string, value: unknown): number | null;
export function latestWeather(location: WeatherLocation | undefined | null, now?: number): WeatherDataPoint | null;
export function isWeatherStale(point: {time: string}, now?: number): boolean;
export function weatherTimeParts(time: string): {month: string; day: string; hours: string; minutes: string};
export function forecastLocations(grid: unknown, now?: number): ForecastLocation[];
