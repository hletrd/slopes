#!/usr/bin/env python3
import json
import os
import html


def create_html_page(
  resort_id, resort_name, webcam_index, webcam_name, video_url, video_type
):
  if not video_url:
    return None

  if video_type == 'iframe':
    video_html = f'''
    <div class="iframe-container">
      <iframe src="{html.escape(video_url)}" allowfullscreen></iframe>
    </div>
    '''
  elif video_type == 'youtube':
    youtube_id = None
    if 'youtube.com' in video_url or 'youtu.be' in video_url:
      if 'v=' in video_url:
        youtube_id = video_url.split('v=')[1].split('&')[0]
      elif 'youtu.be/' in video_url:
        youtube_id = video_url.split('youtu.be/')[1].split('?')[0]

    if youtube_id:
      embed_url = f"https://www.youtube.com/embed/{youtube_id}?autoplay=1&mute=1"
      video_html = f'''
      <div class="iframe-container">
        <iframe src="{embed_url}" allowfullscreen></iframe>
      </div>
      '''
    else:
      return None
  elif video_type == 'link':
    return None
  else:
    video_html = f'''
    <video
      id="webcam-player"
      class="video-js vjs-theme-forest vjs-big-play-centered"
      controls
      autoplay
      muted
      playsinline
    >
      <source src="{html.escape(video_url)}"
      type="application/x-mpegURL">
      <p class="vjs-no-js">
        최신 브라우저를 사용하세요.
      </p>
    </video>
    '''

  title = f"{html.escape(resort_name)} - {html.escape(webcam_name)}"

  videojs_css = "https://cdn.jsdelivr.net/npm/video.js@8.22.0/dist/video-js.min.css"
  forest_theme = "https://cdn.jsdelivr.net/npm/@videojs/themes@1/dist/forest/index.css"
  videojs_js = "https://cdn.jsdelivr.net/npm/video.js@8.22.0/dist/video.min.js"

  return f'''<!DOCTYPE html>
<html data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link href="{videojs_css}" rel="stylesheet" />
  <link href="{forest_theme}" rel="stylesheet" />
  <style>
  body, html {{
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #000;
  }}
  .video-container {{
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }}
  .video-js {{
    width: 100%;
    height: 100%;
  }}
  .iframe-container {{
    width: 100%;
    height: 100vh;
    position: relative;
  }}
  .iframe-container iframe {{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }}
  .info-overlay {{
    position: absolute;
    top: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 8px 16px;
    font-family: Arial, sans-serif;
    z-index: 10;
  }}
  </style>
</head>
<body>
  <div class="video-container">
  {video_html}
  </div>
  <div class="info-overlay">
  <h3>{title}</h3>
  </div>

  <script src="{videojs_js}"></script>
  <script>
  document.addEventListener('DOMContentLoaded', function() {{
    const player = document.getElementById('webcam-player');
    if (player) {{
    videojs('webcam-player', {{
      liveui: true,
      responsive: true,
      fluid: false,
      liveTracker: {{
      trackingThreshold: 0,
      liveTolerance: 15
      }}
    }});
    }}
  }});
  </script>
</body>
</html>'''


def main():
  if not os.path.exists('static'):
    os.makedirs('static')

  with open('links.json', 'r', encoding='utf-8') as f:
    resorts = json.load(f)

  generated_count = 0

  for resort in resorts:
    resort_id = resort.get('id')
    resort_name = resort.get('name')

    if not resort_id or not resort_name:
      continue

    links = resort.get('links', [])

    for index, webcam in enumerate(links):
      webcam_name = webcam.get('name')
      video_url = webcam.get('video')
      video_type = webcam.get('video_type', '')

      if not webcam_name or not video_url:
        continue

      html_content = create_html_page(
        resort_id,
        resort_name,
        index,
        webcam_name,
        video_url,
        video_type
      )

      if html_content:
        filename = f"static/{resort_id}_{index}.html"
        with open(filename, 'w', encoding='utf-8') as f:
          f.write(html_content)
        generated_count += 1
        print(f"Generated {filename} - {resort_name}: {webcam_name}")

  print(f"Completed. Total pages generated: {generated_count}")


if __name__ == "__main__":
  main()