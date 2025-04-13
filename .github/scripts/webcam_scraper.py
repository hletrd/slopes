#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor


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


def process_link(item, resort_id):
  link = item.get('link')
  video = item.get('video')
  result = {"modified": False, "item": item}

  if link:
    print(f"[{resort_id}] Processing link: {link}")

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
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
      print("Saved links.json successfully")
    else:
      print("No changes to links.json")

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