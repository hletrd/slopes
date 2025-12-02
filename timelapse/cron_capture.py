#!/usr/bin/env python3

import datetime as dt
import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

import pymysql
from dotenv import load_dotenv

try:
  import fcntl
except ImportError:
  fcntl = None

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LINKS_PATH = ROOT_DIR / "links.json"
DEFAULT_ENV_PATH = Path(__file__).with_name("timelapse.env")
LOCK_PATH = Path(__file__).with_name(".timelapse.lock")

logging.basicConfig(
  level=logging.INFO,
  format="%(asctime)s [%(levelname)s] %(message)s",
)


def load_config() -> Dict[str, object]:
  env_file = Path(os.getenv("TIMELAPSE_ENV_FILE", DEFAULT_ENV_PATH))
  if env_file.exists():
    load_dotenv(env_file)
  else:
    logging.info("Env file not found at %s (using process env only)", env_file)

  required_keys = [
    "MYSQL_HOST",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_DATABASE",
  ]
  missing = [key for key in required_keys if not os.getenv(key)]
  if missing:
    raise SystemExit(f"Missing required env vars: {', '.join(missing)}")

  ffmpeg_bin = os.getenv("FFMPEG_BIN", "ffmpeg")
  if not shutil.which(ffmpeg_bin):
    raise SystemExit(f"ffmpeg not found at '{ffmpeg_bin}'. Set FFMPEG_BIN.")

  streams_path = Path(os.getenv("STREAMS_FILE", DEFAULT_LINKS_PATH))
  if not streams_path.is_absolute():
    streams_path = (ROOT_DIR / streams_path).resolve()

  return {
    "mysql_host": os.getenv("MYSQL_HOST"),
    "mysql_port": int(os.getenv("MYSQL_PORT", "3306")),
    "mysql_user": os.getenv("MYSQL_USER"),
    "mysql_password": os.getenv("MYSQL_PASSWORD"),
    "mysql_db": os.getenv("MYSQL_DATABASE"),
    "mysql_table": os.getenv("MYSQL_TABLE", "timelapse_frames"),
    "ffmpeg_bin": ffmpeg_bin,
    "ffmpeg_timeout": int(os.getenv("CAPTURE_TIMEOUT_SECONDS", "15")),
    "scale_width": int(os.getenv("CAPTURE_WIDTH", "1280")),
    "avif_speed": os.getenv("AVIF_SPEED", "6"),
    "streams_file": streams_path,
    "max_streams": int(os.getenv("MAX_STREAMS_PER_RUN", "0")),
  }


def acquire_lock():
  if not fcntl:
    logging.warning("fcntl unavailable; skipping lock (may allow overlaps)")
    return None

  lock_file = LOCK_PATH.open("w")
  try:
    fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
  except BlockingIOError:
    logging.info("Previous run is still in progress; exiting.")
    sys.exit(0)
  return lock_file


def load_streams(path: Path) -> Iterable[Dict[str, str]]:
  if not path.exists():
    raise SystemExit(f"Streams file not found: {path}")

  with path.open(encoding="utf-8") as fh:
    data = json.load(fh)

  for resort in data:
    if resort.get("fetch") is False:
      continue
    links = resort.get("links") or []
    for link in links:
      stream_url = link.get("video")
      slope_name = link.get("name") or ""
      if not stream_url:
        continue
      yield {
        "resort_id": resort.get("id") or "",
        "resort_name": resort.get("name") or "",
        "slope_name": slope_name,
        "stream_url": stream_url,
      }


def capture_avif(
  stream_url: str, config: Dict[str, object]
) -> Tuple[Optional[bytes], str]:
  ffmpeg_bin = config["ffmpeg_bin"]
  timeout = config["ffmpeg_timeout"]
  scale_width = config["scale_width"]
  avif_speed = config["avif_speed"]

  avif_cmd = [
    ffmpeg_bin,
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    stream_url,
    "-frames:v",
    "1",
    "-vf",
    f"scale={scale_width}:-2",
    "-an",
    "-c:v",
    "libaom-av1",
    "-still-picture",
    "1",
    "-cpu-used",
    str(avif_speed),
    "-f",
    "image2",
    "pipe:1",
  ]

  try:
    result = subprocess.run(
      avif_cmd,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      timeout=timeout,
      check=True,
    )
    if result.stdout:
      return result.stdout, "avif"
    logging.warning("ffmpeg produced empty output for %s", stream_url)
  except subprocess.TimeoutExpired:
    logging.warning("ffmpeg timed out for %s", stream_url)
  except subprocess.CalledProcessError as exc:
    stderr = exc.stderr.decode(errors="ignore") if exc.stderr else ""
    logging.warning("ffmpeg failed for %s: %s", stream_url, stderr.strip())

  png_bytes = capture_png(stream_url, config)
  if not png_bytes:
    return None, ""

  avif_bytes = convert_png_to_avif(png_bytes, config)
  return avif_bytes, "avif" if avif_bytes else ""


def capture_png(stream_url: str, config: Dict[str, object]) -> Optional[bytes]:
  ffmpeg_bin = config["ffmpeg_bin"]
  timeout = config["ffmpeg_timeout"]
  scale_width = config["scale_width"]

  png_cmd = [
    ffmpeg_bin,
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    stream_url,
    "-frames:v",
    "1",
    "-vf",
    f"scale={scale_width}:-2",
    "-an",
    "-f",
    "image2",
    "-vcodec",
    "png",
    "pipe:1",
  ]

  try:
    result = subprocess.run(
      png_cmd,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      timeout=timeout,
      check=True,
    )
    if result.stdout:
      logging.info("Captured PNG fallback for %s", stream_url)
      return result.stdout
  except subprocess.TimeoutExpired:
    logging.warning("PNG capture timed out for %s", stream_url)
  except subprocess.CalledProcessError as exc:
    stderr = exc.stderr.decode(errors="ignore") if exc.stderr else ""
    logging.warning("PNG capture failed for %s: %s", stream_url, stderr.strip())
  return None


def convert_png_to_avif(png_bytes: bytes, config: Dict[str, object]) -> Optional[bytes]:
  ffmpeg_bin = config["ffmpeg_bin"]
  timeout = config["ffmpeg_timeout"]
  avif_speed = config["avif_speed"]

  cmd = [
    ffmpeg_bin,
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-f",
    "image2pipe",
    "-vcodec",
    "png",
    "-i",
    "pipe:0",
    "-frames:v",
    "1",
    "-an",
    "-c:v",
    "libaom-av1",
    "-still-picture",
    "1",
    "-cpu-used",
    str(avif_speed),
    "-f",
    "image2",
    "pipe:1",
  ]

  try:
    result = subprocess.run(
      cmd,
      input=png_bytes,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      timeout=timeout,
      check=True,
    )
    if result.stdout:
      return result.stdout
  except subprocess.TimeoutExpired:
    logging.warning("PNG->AVIF conversion timed out")
  except subprocess.CalledProcessError as exc:
    stderr = exc.stderr.decode(errors="ignore") if exc.stderr else ""
    logging.warning("PNG->AVIF conversion failed: %s", stderr.strip())
  return None


def ensure_table(connection, table_name: str):
  create_sql = f"""
    CREATE TABLE IF NOT EXISTS `{table_name}` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      `resort_id` VARCHAR(64) NOT NULL,
      `resort_name` VARCHAR(255) NOT NULL,
      `slope_name` VARCHAR(255) NOT NULL,
      `stream_url` TEXT,
      `captured_at` DATETIME NOT NULL,
      `image_format` VARCHAR(8) NOT NULL,
      `image_bytes` LONGBLOB NOT NULL,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY `uniq_capture` (`resort_id`, `slope_name`, `captured_at`)
    ) CHARACTER SET utf8mb4;
  """
  with connection.cursor() as cursor:
    cursor.execute(create_sql)
  connection.commit()


def save_frame(
  connection,
  table_name: str,
  frame: Dict[str, str],
  captured_at: dt.datetime,
  image_bytes: bytes,
  image_format: str,
):
  sql = f"""
    INSERT INTO `{table_name}` (
      resort_id, resort_name, slope_name, stream_url,
      captured_at, image_format, image_bytes
    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
      stream_url = VALUES(stream_url),
      image_format = VALUES(image_format),
      image_bytes = VALUES(image_bytes)
  """
  values = (
    frame["resort_id"],
    frame["resort_name"],
    frame["slope_name"],
    frame["stream_url"],
    captured_at,
    image_format,
    image_bytes,
  )
  with connection.cursor() as cursor:
    cursor.execute(sql, values)
  connection.commit()


def connect_mysql(config: Dict[str, object]):
  return pymysql.connect(
    host=config["mysql_host"],
    port=config["mysql_port"],
    user=config["mysql_user"],
    password=config["mysql_password"],
    database=config["mysql_db"],
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=False,
  )


def main():
  config = load_config()
  lock_file = acquire_lock()

  streams = list(load_streams(config["streams_file"]))
  if config["max_streams"] > 0:
    streams = streams[: config["max_streams"]]

  if not streams:
    logging.info("No streams to capture; exiting.")
    return

  connection = connect_mysql(config)
  ensure_table(connection, config["mysql_table"])

  captured_at = dt.datetime.utcnow().replace(microsecond=0)
  success = 0
  for frame in streams:
    image_bytes, image_format = capture_avif(frame["stream_url"], config)
    if not image_bytes:
      logging.warning("Skipping %s (%s) due to capture failure", frame["resort_name"], frame["slope_name"])
      continue
    save_frame(connection, config["mysql_table"], frame, captured_at, image_bytes, image_format)
    success += 1
    logging.info("Stored %s (%s)", frame["resort_name"], frame["slope_name"])

  connection.close()
  if lock_file:
    try:
      lock_file.close()
    except Exception:
      pass

  logging.info("Done. Captured %s/%s streams at %s UTC", success, len(streams), captured_at.isoformat())


if __name__ == "__main__":
  main()
