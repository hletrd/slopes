#!/usr/bin/env python3
import requests
import json
import os
import sys
from datetime import datetime, timedelta
import pytz
from PIL import Image, ImageDraw, ImageFont
import os.path

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

def fetch_weather_data_for_location(lat, lon, location_name, resort_name, auth_key):
  kst = pytz.timezone('Asia/Seoul')
  now = datetime.now(kst)
  six_hours_ago = now - timedelta(hours=HOURS)

  tm1 = format_datetime(six_hours_ago)
  tm2 = format_datetime(now)

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
  title_y = int(height * 0.085)
  date_y = int(height * 0.145)
  separator_y = int(height * 0.19)
  content_start_y = int(height * 0.235)
  row_height = int(height * 0.147)

  bold_font_path = os.path.join(os.path.dirname(__file__), "NotoSansKR-Bold.ttf")
  regular_font_path = os.path.join(os.path.dirname(__file__), "NotoSansKR-Regular.ttf")

  title_size = int(width * 0.033)
  header_size = int(width * 0.019)
  label_size = int(width * 0.014)
  small_size = int(width * 0.011)

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
    resort_name = resort.get("name", "Unknown Resort")
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
  max_resorts = min(10, len(base_areas))
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

  keys_to_remove = []
  for key in weather_data_dict:
    if key not in valid_keys:
      keys_to_remove.append(key)
      removed_locations += 1

  for key in keys_to_remove:
    del weather_data_dict[key]

  print(f"Removed {removed_locations} locations no longer in links.json")

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
        key = f"{resort_name}:{location_name}"
        if key in weather_data_dict:
          weather_data_dict[key] = result
          updated_locations += 1
        else:
          weather_data_dict[key] = result
          new_locations += 1

  updated_weather_data = list(weather_data_dict.values())

  if updated_weather_data:
    output_file = "weather.json"
    with open(output_file, "w", encoding="utf-8") as f:
      json.dump(updated_weather_data, f, ensure_ascii=False, indent=2)

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