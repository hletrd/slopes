#!/usr/bin/env python3
import requests
import json
import os
import sys
from datetime import datetime, timedelta
import pytz
from PIL import Image, ImageDraw, ImageFont
import os.path
import threading
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
import time
import re
from bs4 import BeautifulSoup
import math
import dotenv

dotenv.load_dotenv()

HOURS = 1
INTERVAL = 60

def format_datetime(dt):
  return dt.strftime("%Y%m%d%H%M")

def convert_to_iso8601(time_str):
  year = time_str[0:4]
  month = time_str[4:6]
  day = time_str[6:8]
  hour = time_str[8:10]
  minute = time_str[10:12]

  return f"{year}-{month}-{day}T{hour}:{minute}:00+09:00"

def fetch_weather_data_for_location(lat, lon, location_name, resort_name, auth_key, is_north_korea=False):
  kst = pytz.timezone('Asia/Seoul')
  now = datetime.now(kst)
  six_hours_ago = now - timedelta(hours=HOURS)

  tm1 = format_datetime(six_hours_ago)
  tm2 = format_datetime(now)

  if is_north_korea:
    base_url = "https://apihub.kma.go.kr/api/typ01/url/nko_sfctm.php"
  else:
    base_url = "https://apihub.kma.go.kr/api/typ01/url/sfc_nc_var.php"
  params = (
    f"?tm1={tm1}&tm2={tm2}&lon={lon}&lat={lat}"
    f"&obs=ta,hm,ws_10m,rn_60m,sd_tot,sd_3hr&itv={INTERVAL}&help=0"
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

def generate_preview_image(weather_data, resorts):
  print("Generating preview image...")

  width, height = 2400, 1260
  image = Image.new('RGB', (width, height), (18, 18, 18))
  draw = ImageDraw.Draw(image)

  margin_x = int(width * 0.083)
  margin_y = int(height * 0.048)
  title_y = int(height * 0.07)
  date_y = int(height * 0.135)
  separator_y = int(height * 0.183)
  content_start_y = int(height * 0.215)
  row_height = int(height * 0.125)

  bold_font_path = os.path.join(os.path.dirname(__file__), "Pretendard-Bold.ttf")
  regular_font_path = os.path.join(os.path.dirname(__file__), "Pretendard-Regular.ttf")

  title_size = int(width * 0.03)
  header_size = int(width * 0.016)
  label_size = int(width * 0.0125)
  small_size = int(width * 0.0105)

  try:
    title_font = ImageFont.truetype(bold_font_path, title_size)
    header_font = ImageFont.truetype(bold_font_path, header_size)
    label_font = ImageFont.truetype(regular_font_path, label_size)
    small_font = ImageFont.truetype(regular_font_path, small_size)
  except IOError as e:
    print(f"Error loading font: {e}")
    title_font = ImageFont.load_default()
    header_font = ImageFont.load_default()
    label_font = ImageFont.load_default()
    small_font = ImageFont.load_default()

  draw.text((width/2, title_y), "Slopes cam", fill=(255, 255, 255), font=title_font, anchor="mm")

  kst = pytz.timezone('Asia/Seoul')
  now = datetime.now(kst)
  date_str = f"{now.year}년 {now.month}월 {now.day}일 {now.hour:02d}:{now.minute:02d} 기준"
  draw.text((width/2, date_y), date_str, fill=(200, 200, 200), font=small_font, anchor="mm")

  draw.line([(margin_x, separator_y), (width-margin_x, separator_y)], fill=(80, 80, 80), width=2)

  base_areas = []
  for resort in resorts:
    resort_name = resort.get("name", "")
    if 'hide_preview' in resort and resort['hide_preview']:
      continue

    base_area = next((w for w in weather_data if w["resort"] == resort_name and w["name"] == "스키하우스"), None)

    if base_area and base_area.get("data") and len(base_area["data"]) > 0:
      most_recent = base_area["data"][-1]
      base_areas.append({
        "name": resort_name,
        "temperature": most_recent["temperature"],
        "humidity": most_recent["humidity"],
        "wind_speed": most_recent["wind_speed"],
        "rainfall": most_recent["rainfall"],
        "snowfall": most_recent["snowfall_3hr"]
      })

  base_areas.sort(key=lambda x: x["temperature"])

  columns = 2
  max_resorts = min(12, len(base_areas))
  col_width = (width - 2 * margin_x) / columns

  for i, resort in enumerate(base_areas[:max_resorts]):
    col = i % columns
    row = i // columns

    x = margin_x + col * col_width
    y = content_start_y + row * row_height

    draw.text((x, y), resort["name"], fill=(255, 255, 255), font=header_font)

    metrics_y = y + int(height * 0.045)
    metrics_line2_y = metrics_y + int(height * 0.033)
    metrics_col2_x = x + int(width * 0.125)
    metrics_col3_x = x + int(width * 0.25)

    draw.text((x, metrics_y), f"{resort['temperature']:.1f}°C",
              fill=(255, 107, 107), font=label_font)

    draw.text((x, metrics_line2_y), f"3시간 적설  {resort['snowfall']:.1f}cm",
              fill=(208, 235, 255), font=label_font)

    draw.text((metrics_col2_x, metrics_y), f"습도  {resort['humidity']:.0f}%",
              fill=(74, 192, 252), font=label_font)

    draw.text((metrics_col2_x, metrics_line2_y), f"10분 풍속  {resort['wind_speed']:.1f}m/s",
              fill=(32, 201, 151), font=label_font)

    draw.text((metrics_col3_x, metrics_y), f"1시간 강수  {resort['rainfall']:.1f}mm",
              fill=(77, 171, 247), font=label_font)

  try:
    image_png = image.convert('RGB')
    image_png = image_png.quantize(colors=256)
    image_png.save("preview.png", format='PNG', optimize=True, compress_level=9)

    print("Preview images saved as preview.png")
  except Exception as e:
    print(f"Error saving preview image: {e}")

def fetch_weather_data_from_resort(resort_name, is_north_korea=False):
  try:
    # 지산 포레스트 리조트: 케이웨더 정보 제공
    # 엘리시안 강촌: 기상청 정보 제공
    # 비발디파크: 제공 여부 불명
    # 오크밸리: 제공 여부 불명
    # 웰리힐리파크: 기상청 정보 제공으로 추정
    # 휘닉스 파크: 확인 예정
    # 알펜시아 리조트: 기상청 정보 제공
    # 모나 용평: 웨더아이 정보 제공
    # 하이원 리조트: 웨더아이 정보 제공
    # 오투리조트: 제공 여부 붕명
    # 에덴밸리리조트: 웨더아이 정보 제공
    links = {
      "곤지암리조트": "https://m.konjiamresort.co.kr/contact/weather.dev",
      "무주 덕유산 리조트": "https://www.mdysresort.com/guide/weather_1.asp"
    }
    print(resort_name)

    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)

    template = {
      "name": "",
      "resort": resort_name,
      "location": {
        "latitude": None,
        "longitude": None
      },
      "timestamp": now.isoformat(),
      "data": [
        {
          "time": now.isoformat(),
          "temperature": None,
          "weather_condition": None,
          "humidity": None,
          "wind_speed": None,
          "rainfall": None,
          "snow_cover": None,
          "snowfall_3hr": None
        }
      ]
    }

    if resort_name not in links:
      print(f"No weather link found for {resort_name}")
      return None

    response = requests.get(links[resort_name], timeout=30)

    if response.status_code != 200:
      print(f"Failed to fetch weather data from {resort_name}: {response.status_code}")
      return None

    results = []

    if resort_name == "곤지암리조트":
      temperature = None
      try:
        temperature_part = response.text.split('<span class="cur-tprt"><span class="system">')[1].split("<")[0].strip()
        temperature = float(temperature_part)
        print(f"Found temperature for {resort_name}: {temperature}°C")
      except (IndexError, ValueError) as e:
        print(f"Error parsing temperature for {resort_name}: {e}")

      if temperature is not None:
        result = template.copy()
        result["name"] = "리조트_베이스"
        result["data"][0]["temperature"] = temperature
        results.append(result)

    elif resort_name == "무주 덕유산 리조트":
      soup = BeautifulSoup(response.text, 'html.parser')
      try:
        table = soup.select_one("table")
        if table:
          tbody = table.select_one("tbody")
          if tbody:
            index = tbody.select_one("tr").select("th")[1:]
            data = tbody.select("tr")[1:]
            for k, v in enumerate(index):
              result = json.loads(json.dumps(template))  # deep copy
              result["name"] = "리조트_" + v.text.strip()
              result["data"][0]["temperature"] = float(data[0].select("td")[k].text.strip())
              result["data"][0]["humidity"] = float(data[1].select("td")[k].text.strip())
              result["data"][0]["wind_speed"] = float(data[2].select("td")[k].text.strip())
              results.append(result)
      except Exception as e:
        print(f"Error parsing data for {resort_name}: {e}")
    return results if results else None

  except Exception as e:
    print(f"Error fetching weather data from link for {resort_name}: {e}")

  return None

# KMA API
def process_grid(grid_text):
  results = []

  lines = [line for line in grid_text.strip().splitlines() if line.strip()]

  PI = 3.141592
  RE = 6371.00877
  GRID = 5.0
  SLAT1, SLAT2 = 30.0, 60.0
  OLON, OLAT = 126.0, 38.0
  XO, YO = 210.0/GRID, 675.0/GRID

  DEGRAD = PI / 180.0
  RADDEG = 180.0 / PI

  re  = RE / GRID                              # scaled Earth radius
  slat1 = SLAT1 * DEGRAD
  slat2 = SLAT2 * DEGRAD
  olon  = OLON  * DEGRAD
  olat  = OLAT  * DEGRAD

  sn = math.log(math.cos(slat1) / math.cos(slat2)) / \
      math.log(math.tan(PI*0.25 + slat2*0.5) / math.tan(PI*0.25 + slat1*0.5))

  sf = (math.tan(PI*0.25 + slat1*0.5) ** sn) * math.cos(slat1) / sn

  ro = re * sf / (math.tan(PI*0.25 + olat*0.5) ** sn)

  for j, line in enumerate(lines):
    for i, token in enumerate(line.split()):
      value = float(token)
      if value == -99.0:
        continue  # skip invalid data

      # 1-based grid coordinates
      x = i + 1
      y = j + 1

      # Inverse LCC (as above)
      dx = x - XO
      dy = ro - (y - YO)
      ra = math.hypot(dx, dy)
      if sn < 0:
        ra = -ra
      alat = 2.0 * math.atan((re * sf / ra)**(1.0/sn)) - PI*0.5
      theta = math.atan2(dx, dy)
      alon  = theta/sn + olon

      # Degrees
      lat = alat * RADDEG
      lng = alon * RADDEG

      results.append({"lat": lat, "lng": lng, "tmp": value})

  return results

# KMA API
def fetch_weather_grid(auth_key):
  kst = pytz.timezone('Asia/Seoul')
  now = datetime.now(kst)

  target_hours = [2, 5, 8, 11, 14, 17, 20, 23]

  # if now.minute >= 10:
  #   return

  # if now.hour not in target_hours:
  #   return

  grid_data = {"weathers": [], "last_fetch_time": None}

  current_hour = now.hour
  most_recent_target = None

  for hour in target_hours:
    if current_hour >= hour:
      most_recent_target = hour
    else:
      break

  if most_recent_target is None:
    most_recent_target = target_hours[-1]

  target_time = now.replace(hour=most_recent_target, minute=0, second=0, microsecond=0)
  if most_recent_target > current_hour:
    target_time = target_time - timedelta(days=1)

  print(f"Fetching weather grid data for {target_time}")

  time1 = target_time.strftime("%Y%m%d%H")

  forecast_times = []
  for hour_offset in range(49):
    forecast_time = target_time + timedelta(hours=hour_offset)
    forecast_times.append(forecast_time.strftime("%Y%m%d%H"))

  weathers = []
  for time2 in forecast_times:
    url = f"https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-dfs_shrt_grd?tmfc={time1}&tmef={time2}&vars=TMP&authKey={auth_key}"

    try:
      response = requests.get(url, timeout=30)

      if response.status_code != 200:
        print(f"Error fetching weather grid data: HTTP {response.status_code} for url {url}")
        continue

      weathers.append({
        "time": time2,
        "data": response.text
      })

    except Exception as e:
      print(f"Error fetching weather grid data for time {time2}: {e}")

  grid_data = {
    "weathers": weathers,
    "last_fetch_time": target_time.isoformat()
  }

  with open('weather.grid.json', 'w', encoding='utf-8') as f:
    json.dump(grid_data, f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

  print(f"Successfully saved weather grid data with {len(weathers)} time points")

def fetch_forecast_openweather(resorts):
  api_key = os.environ.get("OPENWEATHER_API_KEY")

  kst = pytz.timezone('Asia/Seoul')
  now = datetime.now(kst)

  if not api_key:
    print("OPENWEATHER_API_KEY environment variable not set")
    return

  if os.environ.get("RUN_LOCAL") is None:
    gmt = datetime.now(pytz.timezone('GMT'))
    gmt_hour = gmt.hour

    if gmt_hour not in [0, 3, 6, 9, 12, 15, 18, 21]:
      print(f"Data for current hour is not available, skipping OpenWeatherMap fetch")
      return

    if now.minute >= 10:
      print("Current minute is >= 10, skipping OpenWeatherMap fetch")
      return

  print(f"Fetching weather data from OpenWeatherMap")

  locations = []
  for resort in resorts:
    resort_name = resort.get("name", "")
    coordinates = resort.get("coordinates", [])

    for location in coordinates:
      lat = location.get("latitude")
      lon = location.get("longitude")
      location_name = location.get("name", "Unknown")

      if lat is not None and lon is not None:
        locations.append({
          "resort": resort_name,
          "name": location_name,
          "lat": lat,
          "lon": lon
        })

  weathers = []
  for location in locations:
    url = f"https://api.openweathermap.org/data/2.5/forecast?lat={location['lat']}&lon={location['lon']}&units=metric&appid={api_key}"

    try:
      print(f'Fetching OpenWeatherMap data for {location["resort"]} - {location["name"]}')
      response = requests.get(url, timeout=30)

      if response.status_code != 200:
        print(f"Error fetching OpenWeatherMap data for {location['resort']} - {location['name']}: HTTP {response.status_code}")
        continue

      data = response.json()

      location_data = {
        "resort": location["resort"],
        "name": location["name"],
        "location": {
          "latitude": location["lat"],
          "longitude": location["lon"]
        },
        "forecasts": []
      }

      for item in data.get("list", []):
        if 'main' not in item or 'dt' not in item:
          continue

        timestamp = item['dt']
        main = item['main']
        wind = item.get("wind", {})
        snow = item.get("snow", {})
        rain = item.get("rain", {})

        forecast = {
          "timestamp": timestamp,
          "temp": main.get("temp"),
          "feels_like": main.get("feels_like"),
          "humidity": main.get("humidity"),
          "wind_speed": wind.get("speed", 0),
          "snow_3h": snow.get("3h", 0),
          "rain_3h": rain.get("3h", 0)
        }

        location_data["forecasts"].append(forecast)

      weathers.append(location_data)

    except Exception as e:
      print(f"Error fetching OpenWeatherMap data for {location['resort']} - {location['name']}: {e}")

  result_data = {
    "weathers": weathers,
    "last_fetch_time": now.isoformat(),
  }

  with open('weather.grid.json', 'w', encoding='utf-8') as f:
    json.dump(result_data, f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

  print(f"Successfully saved OpenWeatherMap data for {len(weathers)} locations")

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

  fetch_forecast_openweather(resorts)

  existing_weather_data = []
  try:
    with open('weather.json', 'r', encoding='utf-8') as f:
      existing_weather_data = json.load(f)
      print(f"Loaded existing weather data with {len(existing_weather_data)} entries")
  except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"No existing weather data found or file is invalid: {e}")

  weather_data_dict = {}
  for entry in existing_weather_data:
    key = f"{entry['resort']}:{entry['name']}"
    weather_data_dict[key] = entry

  updated_locations = 0
  new_locations = 0
  removed_locations = 0

  valid_keys = set()
  for resort in resorts:
    resort_name = resort.get("name", "")
    coordinates = resort.get("coordinates", [])

    for location in coordinates:
      location_name = location.get("name", "")
      valid_keys.add(f"{resort_name}:{location_name}")

    valid_keys.add(f"{resort_name}:리조트")

  keys_to_remove = []
  for key in weather_data_dict:
    if key not in valid_keys:
      keys_to_remove.append(key)
      removed_locations += 1

  for key in keys_to_remove:
    del weather_data_dict[key]

  print(f"Removed {removed_locations} locations no longer in links.json")

  fetch_tasks = []
  for resort in resorts:
    resort_name = resort.get("name", "")
    resort_id = resort.get("id", "")
    coordinates = resort.get("coordinates", [])
    weather_link = resort.get("weather_link")
    is_north_korea = resort.get("is_north_korea", False)
    if resort.get('fetch_weather', True) is False:
      continue

    resort_weathers = fetch_weather_data_from_resort(resort_name, is_north_korea)
    if resort_weathers and len(resort_weathers) > 0:
      for resort_weather in resort_weathers:
        key = f"{resort_name}:{resort_weather['name']}"
        if key in weather_data_dict:
          weather_data_dict[key] = resort_weather
          updated_locations += 1
        else:
          weather_data_dict[key] = resort_weather
          new_locations += 1

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

      fetch_tasks.append((resort_name, location_name, lat, lon, full_name))

  lock = Lock()

  def fetch_location_data(resort_name, location_name, lat, lon, full_name):
    print(f"Fetching weather data for {full_name}")

    result = None
    for attempt in range(2):
      result = fetch_weather_data_for_location(
        lat, lon, location_name, resort_name, auth_key
      )

      if result:
        break
      elif attempt == 0:
        print(f"Retrying to fetch weather data for {full_name}...")

    if result:
      key = f"{resort_name}:{location_name}"
      with lock:
        if key in weather_data_dict:
          weather_data_dict[key] = result
          nonlocal updated_locations
          updated_locations += 1
        else:
          weather_data_dict[key] = result
          nonlocal new_locations
          new_locations += 1

  with ThreadPoolExecutor(max_workers=40) as executor:
    for task in fetch_tasks:
      resort_name, location_name, lat, lon, full_name = task
      executor.submit(fetch_location_data, resort_name, location_name, lat, lon, full_name)
      time.sleep(0.1)

  updated_weather_data = list(weather_data_dict.values())

  if updated_weather_data:
    output_file = "weather.json"
    with open(output_file, "w", encoding="utf-8") as f:
      json.dump(updated_weather_data, f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

    print(
      f"Successfully saved weather data for {len(updated_weather_data)} "
      f"locations to {output_file} ({updated_locations} updated, "
      f"{new_locations} new, {removed_locations} removed)"
    )

    generate_preview_image(updated_weather_data, resorts)
  else:
    print("No weather data collected")


if __name__ == "__main__":
  main()