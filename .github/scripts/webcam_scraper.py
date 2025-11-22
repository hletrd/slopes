#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
import datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def extract_m3u8_from_url(url):
  headers = {
    'User-Agent': (
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/135.0.0.0 Safari/537.36'
    )
  }

  try:
    response = requests.get(url, headers=headers, timeout=5)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')

    page_text = soup.get_text()
    m3u8_pattern = r'https?://[^\s\'"]+\.m3u8[^\s\'"]*'
    m3u8_matches = re.findall(m3u8_pattern, page_text)
    if m3u8_matches:
      return m3u8_matches[0]

    for script in soup.find_all('script'):
      if script.string:
        script_m3u8 = re.findall(m3u8_pattern, script.string)
        if script_m3u8:
          return script_m3u8[0]

    for tag in soup.find_all(True):
      for attr in tag.attrs:
        if isinstance(tag[attr], str) and '.m3u8' in tag[attr]:
          attr_m3u8 = re.findall(m3u8_pattern, tag[attr])
          if attr_m3u8:
            return attr_m3u8[0]

    return None
  except Exception as e:
    print(f"Error extracting m3u8 from {url}: {e}")
    return None


def get_alpensia_youtube_embed_element(url='https://www.alpensia.com/guide/web-cam.do'):
  headers = {
    'User-Agent': (
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/135.0.0.0 Safari/537.36'
    )
  }

  try:
    response = requests.get(url, headers=headers, timeout=5)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')
    iframe = soup.find('iframe', src=re.compile(r'youtube\.com/embed/'))

    if iframe and iframe.get('src'):
      print(f"[alpensia] Found YouTube embed iframe: {iframe.get('src')}")
      return iframe

    print(f"[alpensia] No YouTube iframe found on {url}")
  except Exception as e:
    print(f"[alpensia] Error fetching YouTube iframe: {e}")

  return None


def _is_live_video_renderer(video_renderer):
  if not video_renderer:
    return False

  if video_renderer.get('isLiveNow') or video_renderer.get('isLive'):
    return True

  for badge in video_renderer.get('badges', []):
    badge_renderer = badge.get('metadataBadgeRenderer', {})
    label = badge_renderer.get('label', '').lower()
    style = badge_renderer.get('style', '')
    if label in ('live', '실시간') or style == 'BADGE_STYLE_TYPE_LIVE_NOW':
      return True

  for overlay in video_renderer.get('thumbnailOverlays', []):
    overlay_renderer = overlay.get('thumbnailOverlayTimeStatusRenderer')
    if overlay_renderer and overlay_renderer.get('style') == 'LIVE':
      return True

  return False


def _find_live_video_id(contents):
  fallback_id = None

  for item in contents:
    video_renderer = (
      item.get('richItemRenderer', {})
      .get('content', {})
      .get('videoRenderer')
    )

    if not video_renderer:
      continue

    video_id = video_renderer.get('videoId')
    if not video_id:
      continue

    if _is_live_video_renderer(video_renderer):
      return video_id

    if not fallback_id:
      fallback_id = video_id

  return fallback_id


def get_youtube_live_video_id(channel_url):
  headers = {
    'User-Agent': (
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/135.0.0.0 Safari/537.36'
    )
  }

  try:
    response = requests.get(channel_url, headers=headers, timeout=10)
    response.raise_for_status()

    text = response.text
    start_token = 'var ytInitialData = '
    start_index = text.find(start_token)
    if start_index == -1:
      print(f"[youtube] ytInitialData not found on {channel_url}")
      return None

    start_index += len(start_token)
    end_index = text.find(';</script>', start_index)
    if end_index == -1:
      print(f"[youtube] ytInitialData end tag not found on {channel_url}")
      return None

    json_text = text[start_index:end_index]
    data = json.loads(json_text)

    tabs = (
      data.get('contents', {})
      .get('twoColumnBrowseResultsRenderer', {})
      .get('tabs', [])
    )

    def extract_contents(tab_renderer):
      if not tab_renderer:
        return []
      content = tab_renderer.get('content', {})
      rich_grid = content.get('richGridRenderer')
      if not rich_grid:
        return []
      return rich_grid.get('contents', [])

    for tab in tabs:
      renderer = tab.get('tabRenderer')
      if renderer and renderer.get('selected'):
        contents = extract_contents(renderer)
        live_video_id = _find_live_video_id(contents)
        if live_video_id:
          return live_video_id

    for tab in tabs:
      renderer = tab.get('tabRenderer')
      contents = extract_contents(renderer)
      if not contents:
        continue
      live_video_id = _find_live_video_id(contents)
      if live_video_id:
        return live_video_id

    print(f"[youtube] No live video found on {channel_url}")
  except Exception as e:
    print(f"[youtube] Error fetching live video id from {channel_url}: {e}")

  return None


def build_proxied_url(stream_url, proxy_ip=None):
  parsed = urlparse(stream_url)

  query = dict(parse_qsl(parsed.query, keep_blank_values=True))
  if proxy_ip:
    query['ip'] = proxy_ip

  new_query = urlencode(query, doseq=True)
  normalized_url = urlunparse(parsed._replace(query=new_query))

  proxy_base = f"/stream_proxy/{parsed.scheme}/{parsed.netloc}{parsed.path}"
  if new_query:
    proxy_url = f"{proxy_base}?{new_query}"
  else:
    proxy_url = proxy_base

  return proxy_url, normalized_url


def ensure_proxy_ip(video_url, proxy_ip):
  if not video_url:
    return None

  if video_url.startswith('/stream_proxy/'):
    base, sep, query = video_url.partition('?')
    params = dict(parse_qsl(query, keep_blank_values=True)) if sep else {}
    if proxy_ip:
      params['ip'] = proxy_ip
    new_query = urlencode(params, doseq=True)
    return f"{base}?{new_query}" if new_query else base

  proxy_url, _ = build_proxied_url(video_url, proxy_ip)
  return proxy_url


def get_rtsp_me_stream_url(embed_url, proxy_ip=None):
  headers = {
    'User-Agent': (
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/135.0.0.0 Safari/537.36'
    )
  }

  try:
    response = requests.get(embed_url, headers=headers, timeout=5)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')
    pattern = re.compile(r"\$\.(?:get|post)\('([^']+\.m3u8[^']*)'\)")

    for script in soup.find_all('script'):
      script_text = script.string or script.get_text()
      if not script_text:
        continue

      match = pattern.search(script_text)
      if match:
        stream_url = match.group(1)
        proxy_url, normalized_url = build_proxied_url(stream_url, proxy_ip)
        print(f"[rtsp.me] Found stream {normalized_url} -> {proxy_url}")
        return proxy_url

    print(f"[rtsp.me] No stream url found on {embed_url}")
  except Exception as e:
    print(f"[rtsp.me] Error fetching stream url from {embed_url}: {e}")

  return None


def process_link(item, resort_id):
  link = item.get('link')
  video = item.get('video')
  result = {"modified": False, "item": item}

  if link:
    print(f"[{resort_id}] Processing link: {link}")

    if resort_id == 'alpensia' and 'alpensia.com/guide/web-cam.do' in link:
      iframe = get_alpensia_youtube_embed_element(link)
      if iframe and iframe.get('src'):
        embed_src = iframe.get('src')
        if video != embed_src:
          item['video'] = embed_src
          print(f"[alpensia] Updated video link to {embed_src}")
          result["modified"] = True
        else:
          print("[alpensia] Video link already up to date")
      else:
        print("[alpensia] Unable to locate YouTube embed iframe")

      return result

    if resort_id == 'elysian' and 'youtube.com/@11-lf8zw' in link:
      live_video_id = get_youtube_live_video_id(link)
      if live_video_id:
        live_video_url = f"https://www.youtube.com/watch?v={live_video_id}"
        if video != live_video_url:
          item['video'] = live_video_url
          print(f"[elysian] Updated video link to {live_video_url}")
          result["modified"] = True

        if item.get('video_type') != 'youtube':
          item['video_type'] = 'youtube'
          result["modified"] = True

        if item.get('name') != '실시간 영상':
          item['name'] = '실시간 영상'
          result["modified"] = True
      else:
        print("[elysian] Unable to locate live YouTube video")

      return result

    if resort_id == 'edenvalley' and 'rtsp.me/embed' in link:
      proxy_ip = '130.162.144.168'
      proxied_url = get_rtsp_me_stream_url(link, proxy_ip=proxy_ip)
      if not proxied_url and video:
        proxied_url = ensure_proxy_ip(video, proxy_ip)
      if proxied_url:
        if video != proxied_url:
          item['video'] = proxied_url
          print(f"[edenvalley] Updated video link to {proxied_url}")
          result["modified"] = True
      else:
        print(f"[edenvalley] Unable to fetch stream url for {link}")

      return result

    if link.endswith('.m3u8'):
      item['video'] = link
      print(f"[{resort_id}] Link is already an m3u8 link: {link}")
      result["modified"] = True
    else:
      m3u8_link = extract_m3u8_from_url(link)
      if resort_id == 'o2resort':
        m3u8_link = m3u8_link.replace('http://', '/stream_proxy/http/')
      if m3u8_link:
        item['video'] = m3u8_link
        print(f"[{resort_id}] Found m3u8 link: {m3u8_link}")
        result["modified"] = True
      else:
        print(f"[{resort_id}] No m3u8 link found for {link}")
  else:
    if video:
      print(f"[{resort_id}] Already has video link: {video}")
    else:
      print(f"[{resort_id}] No link available")

  return result


def process_resort(resort, max_workers):
  resort_id = resort.get('id', 'unknown')
  print(f"Processing resort: {resort_id}")

  if 'links' not in resort:
    return False

  links = resort.get('links', [])
  modified = False

  if not links:
    return modified

  with ThreadPoolExecutor(max_workers=max_workers) as executor:
    futures = [
      executor.submit(process_link, item, resort_id) for item in links
    ]

    for future in futures:
      result = future.result()
      if result["modified"]:
        modified = True

  return modified


def generate_video_ld_json(data):
  print("Generating videos+ld.json...")
  site_url = "http://ski.atik.kr"
  now = datetime.datetime.now()
  future_date = now + datetime.timedelta(days=14)
  formatted_now = now.isoformat() + "+00:00"
  formatted_future = future_date.isoformat() + "+00:00"

  video_objects = []

  for resort in data:
    resort_id = resort.get('id')
    resort_name = resort.get('name', '')

    if not resort_id or 'links' not in resort:
      continue

    for i, item in enumerate(resort.get('links', [])):
      video_url = item.get('video')
      if not video_url:
        continue

      camera_name = item.get('name', '')

      name = f"{resort_name} {camera_name}"
      description = f"스키장 웹캠 - {name}"

      video_object = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "contentURL": video_url,
        "description": description,
        "embedUrl": f"{site_url}/#{resort_id}/{i}",
        "expires": formatted_future,
        "name": name,
        "thumbnailUrl": "/preview.png",
        "uploadDate": formatted_now,
        "publication": [
          {
            "@type": "BroadcastEvent",
            "isLiveBroadcast": True,
            "startDate": formatted_now,
            "endDate": formatted_future
          }
        ]
      }

      video_objects.append(video_object)

  with open('videos+ld.json', 'w', encoding='utf-8') as f:
    json.dump(video_objects, f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

  print(f"Generated videos+ld.json with {len(video_objects)} video objects")


def main():
  try:
    print("Reading links.json file...")
    with open('links.json', 'r', encoding='utf-8') as f:
      data = json.load(f)

    max_workers_per_resort = 5
    max_total_workers = 20

    modified = False
    resort_threads = []
    resort_results = [False] * len(data)

    for i, resort in enumerate(data):
      if resort.get('fetch', True) == False:
        print(f"[{resort.get('id', 'unknown')}] Skipping fetch")
        continue

      target_fn = lambda idx=i, r=resort: resort_results.__setitem__(
        idx, process_resort(r, max_workers_per_resort)
      )

      thread = threading.Thread(target=target_fn)
      resort_threads.append(thread)
      thread.start()

      if len(resort_threads) >= max_total_workers:
        resort_threads[0].join()
        resort_threads.pop(0)

    for thread in resort_threads:
      thread.join()

    modified = any(resort_results)

    if modified:
      print("Saving updated links.json file...")
      with open('links.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
      print("Saved links.json successfully")
    else:
      print("No changes to links.json")

    generate_video_ld_json(data)

    print("Generating sitemap.xml...")
    site_url = "http://ski.atik.kr"

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    sitemap += (
      f'  <url>\n'
      f'  <loc>{site_url}/</loc>\n'
      f'  <priority>1.0</priority>\n'
      f'  <changefreq>monthly</changefreq>\n'
      f'  </url>\n'
    )

    for resort in data:
      resort_id = resort.get('id')
      if resort_id:
        sitemap += (
          f'  <url>\n'
          f'  <loc>{site_url}/#{resort_id}</loc>\n'
          f'  <priority>0.7</priority>\n'
          f'  <changefreq>monthly</changefreq>\n'
          f'  </url>\n'
        )

        if 'links' in resort:
          for i in range(len(resort['links'])):
            sitemap += (
              f'  <url>\n'
              f'  <loc>{site_url}/#{resort_id}/{i}</loc>\n'
              f'  <priority>0.2</priority>\n'
              f'  <changefreq>monthly</changefreq>\n'
              f'  </url>\n'
            )

    sitemap += '</urlset>'

    with open('sitemap.xml', 'w', encoding='utf-8') as f:
      f.write(sitemap)
    print("Generated sitemap.xml successfully")

  except Exception as e:
    print(f"Error processing links.json: {e}")


if __name__ == "__main__":
  main()
