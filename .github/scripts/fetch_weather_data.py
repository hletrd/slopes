#!/usr/bin/env python3
import requests
import json
import os
import sys
from datetime import datetime, timedelta
import pytz

HOURS = 3
INTERVAL = 60  # in minutes

def format_datetime(dt):
  return dt.strftime("%Y%m%d%H%M")

def convert_to_iso8601(time_str):
  year = time_str[0:4]
  month = time_str[4:6]
  day = time_str[6:8]
  hour = time_str[8:10]
  minute = time_str[10:12]

  return f"{year}-{month}-{day}T{hour}:{minute}:00+09:00"

def fetch_weather_data_for_location(lat, lon, location_name, resort_name, auth_key):
  kst = pytz.timezone('Asia/Seoul')
  now = datetime.now(kst)
  six_hours_ago = now - timedelta(hours=HOURS)

  tm1 = format_datetime(six_hours_ago)
  tm2 = format_datetime(now)

  base_url = "https://apihub.kma.go.kr/api/typ01/url/sfc_nc_var.php"
  params = (
    f"?tm1={tm1}&tm2={tm2}&lon={lon}&lat={lat}"
    f"&obs=ta,hm,ws_10m,rn_ox,sd_tot,sd_3hr&itv={INTERVAL}&help=0"
    f"&authKey={auth_key}"
  )
  url = base_url + params

  try:
    response = requests.get(url, timeout=30)

    if response.status_code == 403:
      print(f"Received 403 Forbidden from API for {location_name}")
      return None

    if response.status_code != 200:
      print(
        f"API request failed for {location_name} with status "
        f"code {response.status_code}"
      )
      return None

    content = response.text
    if "#START7777" not in content or "#7777END" not in content:
      print(
        f"Could not find data markers in API response for "
        f"{location_name}"
      )
      return None

    data_text = content.split("#START7777")[1].split("#7777END")[0].strip()

    data_rows = []
    for line in data_text.split("\n"):
      if not line.strip():
        continue

      parts = [part.strip() for part in line.split(",")]
      if len(parts) >= 7:
        iso_time = convert_to_iso8601(parts[0])
        data_rows.append({
          "time": iso_time,
          "temperature": float(parts[1]),
          "humidity": float(parts[2]),
          "wind_speed": float(parts[3]),
          "rainfall": float(parts[4]),
          "snow_cover": float(parts[5]),
          "snowfall_3hr": float(parts[6])
        })

    return {
      "name": location_name,
      "resort": resort_name,
      "location": {
        "latitude": lat,
        "longitude": lon
      },
      "timestamp": now.isoformat(),
      "data": data_rows
    }

  except Exception as e:
    print(f"Error fetching weather data for {location_name}: {e}")
    return None

def main():
  auth_key = os.environ.get("KMA_API_KEY")
  if not auth_key:
    print("KMA_API_KEY environment variable not set")
    sys.exit(1)

  try:
    with open('links.json', 'r', encoding='utf-8') as f:
      resorts = json.load(f)
  except Exception as e:
    print(f"Error reading links.json: {e}")
    sys.exit(1)

  weather_data = []

  for resort in resorts:
    resort_name = resort.get("name", "Unknown Resort")
    coordinates = resort.get("coordinates", [])

    if not coordinates:
      print(f"No coordinates found for {resort_name}, skipping")
      continue

    for location in coordinates:
      location_name = location.get("name", "Unknown Location")
      full_name = f"{resort_name} - {location_name}"
      lat = location.get("latitude")
      lon = location.get("longitude")

      if lat is None or lon is None:
        print(f"Invalid coordinates for {full_name}, skipping")
        continue

      print(f"Fetching weather data for {full_name}")
      result = fetch_weather_data_for_location(
        lat, lon, location_name, resort_name, auth_key
      )

      if result:
        weather_data.append(result)

  if weather_data:
    output_file = "weather.json"
    with open(output_file, "w", encoding="utf-8") as f:
      json.dump(weather_data, f, ensure_ascii=False, indent=2)

    print(
      f"Successfully saved weather data for {len(weather_data)} "
      f"locations to {output_file}"
    )
  else:
    print("No weather data collected")

if __name__ == "__main__":
  main()