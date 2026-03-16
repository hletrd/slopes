export interface Coordinate {
  latitude: number;
  longitude: number;
  name: string;
}

export interface WebcamLink {
  link?: string;
  name: string;
  video?: string;
  video_type?: "youtube" | "vivaldi" | "iframe" | "link";
}

export interface Resort {
  id: string;
  name: string;
  coordinates?: Coordinate[];
  links?: WebcamLink[];
  webcams?: WebcamLink[];
  status?: string;
  fetch?: boolean;
  fetch_weather?: boolean;
  hide_preview?: boolean;
}

export interface WeatherDataPoint {
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  rainfall: number | null;
  snowfall_3hr: number | null;
}

export interface WeatherLocation {
  resort: string;
  name: string;
  timestamp: string;
  data: WeatherDataPoint[];
}

export interface ForecastDataPoint {
  time: string;
  temperature: number;
  wind_speed: number;
  snowfall_3hr: number;
}

export interface ForecastLocation {
  resort: string;
  name: string;
  data: ForecastDataPoint[];
  update_time?: string;
}

export interface FavoriteItem {
  resortId: string;
  webcamIndex: number;
  webcamName: string;
  resortName: string;
  videoUrl: string;
  videoType?: string;
}

export interface AppSettings {
  autoplay: boolean;
  darkMode: boolean;
  quadViewOpen: boolean;
}

export type SupportedLanguage = "ko" | "en";

export interface TranslationData {
  [key: string]: string | TranslationData;
}
