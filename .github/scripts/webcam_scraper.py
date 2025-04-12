#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json
import re
import time


def extract_m3u8_from_url(url):
  headers = {
    'User-Agent': ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                   'AppleWebKit/537.36 (KHTML, like Gecko) '
                   'Chrome/135.0.0.0 Safari/537.36')
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


def main():
  try:
    print("Reading links.json file...")
    with open('links.json', 'r', encoding='utf-8') as f:
      data = json.load(f)

    modified = False

    for resort in data:
      resort_id = resort.get('id', 'unknown')
      print(f"Processing resort: {resort_id}")

      if 'links' in resort:
        links = resort.get('links', [])
        for item in links:
          link = item.get('link')
          video = item.get('video')

          if link:
            print(f"Processing link: {link}")

            if link.endswith('.m3u8'):
              item['video'] = link
              print(f"Link is already an m3u8 link: {link}")
              modified = True
            else:
              m3u8_link = extract_m3u8_from_url(link)
              if m3u8_link:
                item['video'] = m3u8_link
                print(f"Found m3u8 link: {m3u8_link}")
                modified = True
              else:
                print(f"No m3u8 link found for {link}")
          else:
            if video:
              print(f"Already has video link: {video}")
            else:
              print("No link available")

    if modified:
      print("Saving updated links.json file...")
      with open('links.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
      print("Saved links.json successfully")
    else:
      print("No changes to links.json")

  except Exception as e:
    print(f"Error processing links.json: {e}")


if __name__ == "__main__":
  main()