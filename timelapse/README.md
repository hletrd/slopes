# Timelapse capture

Setup:
- Copy `timelapse.env.example` to `timelapse.env` and fill MySQL info.
- Ensure `ffmpeg` with `libaom-av1` is available (`FFMPEG_BIN` env if custom path).
- Install and run with uv:
```
cd timelapse
uv sync
uv run python cron_capture.py
```

Cron (per minute from repo root):
```
* * * * * cd /path/to/ski && uv run timelapse/cron_capture.py >> /var/log/timelapse.log 2>&1
```
