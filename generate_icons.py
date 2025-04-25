#!/usr/bin/env python3
import os
import re
import shutil

import cairosvg
from PIL import Image, ImageOps, ImageDraw

sizes = {
  "regular": [16, 32, 64, 128, 180, 192, 512],
  "maskable": [192, 512],
  "favicon": [64]
}

if not os.path.exists('icons'):
  os.makedirs('icons')

svg_files = list(filter(lambda x: x.endswith('.svg'), os.listdir('icons')))
for svg_file in svg_files:
  if not os.path.isfile(f'icons/{svg_file}'):
    print(f"Error: {svg_file} not found!")
    exit(1)


def create_gradient_background(width, height):
  img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
  draw = ImageDraw.Draw(img)

  for y in range(height):
    r = int(18 + (y / height) * 20)
    g = int(18 + (y / height) * 20)
    b = int(18 + (y / height) * 20)
    alpha = int(210 - (y / height) * 40)
    draw.line([(0, y), (width, y)], fill=(r, g, b, alpha))

  return img


def round_corners(image, radius):
  mask = Image.new('L', image.size, 0)
  draw = ImageDraw.Draw(mask)

  draw.rectangle([radius, 0, image.width - radius, image.height], fill=255)
  draw.rectangle([0, radius, image.width, image.height - radius], fill=255)

  draw.ellipse([0, 0, radius * 2, radius * 2], fill=255)
  draw.ellipse([image.width - radius * 2, 0, image.width, radius * 2], fill=255)
  draw.ellipse([0, image.height - radius * 2, radius * 2, image.height], fill=255)
  draw.ellipse([image.width - radius * 2, image.height - radius * 2,
               image.width, image.height], fill=255)

  result = image.copy()
  result.putalpha(mask)

  return result


def get_white_svg_content(svg_file):
  with open(f"icons/{svg_file}", 'r') as f:
    svg_content = f.read()

  svg_content = re.sub(r'fill="[^"]+"', 'fill="white"', svg_content)
  svg_content = re.sub(r'fill:[^;"]+', 'fill:white', svg_content)

  svg_content = re.sub(r'stroke="[^"]+"', 'stroke="white"', svg_content)
  svg_content = re.sub(r'stroke:[^;"]+', 'stroke:white', svg_content)

  if 'fill=' not in svg_content.split('<svg')[1].split('>')[0]:
    svg_content = svg_content.replace('<svg', '<svg fill="white"', 1)

  return svg_content


def create_regular_icon(svg_file, size):
  base_name = os.path.splitext(svg_file)[0]
  output_file = f"icons/{base_name}-{size}x{size}.png"

  padding_ratio = 0.05
  icon_size = int(size * (1 - padding_ratio * 2))

  svg_content = get_white_svg_content(svg_file)

  cairosvg.svg2png(
    bytestring=svg_content,
    write_to="icons/temp_raw.png",
    output_width=icon_size,
    output_height=icon_size,
    background_color="transparent"
  )

  icon = Image.open("icons/temp_raw.png")
  icon = ImageOps.mirror(icon)

  background = create_gradient_background(size, size)

  padding = int(size * padding_ratio)
  result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
  result.paste(background, (0, 0), background)
  result.paste(icon, (padding, padding), icon)

  result = round_corners(result, int(size * 0.1))

  result.save(output_file, format="PNG")
  shutil.copy(output_file, f"slopes-cam/public/icons/{base_name}-regular-{size}x{size}.png")
  os.remove("icons/temp_raw.png")
  print(f"Created {output_file}")

  return result


def create_maskable_icon(svg_file, size):
  base_name = os.path.splitext(svg_file)[0]
  output_file = f"icons/{base_name}-maskable-{size}x{size}.png"

  outer_padding_ratio = 0.08
  inner_safe_zone_ratio = 0.85

  actual_icon_size = int(size * inner_safe_zone_ratio *
               (1 - outer_padding_ratio * 2))

  svg_content = get_white_svg_content(svg_file)

  cairosvg.svg2png(
    bytestring=svg_content,
    write_to="icons/temp_raw.png",
    output_width=actual_icon_size,
    output_height=actual_icon_size,
    background_color="transparent"
  )

  icon = Image.open("icons/temp_raw.png")
  icon = ImageOps.mirror(icon)

  background = create_gradient_background(size, size)

  inner_padding = int(size * (1 - inner_safe_zone_ratio) / 2)
  outer_padding = int(size * outer_padding_ratio)
  total_padding = inner_padding + outer_padding

  result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
  result.paste(background, (0, 0), background)
  result.paste(icon, (total_padding, total_padding), icon)

  result = round_corners(result, int(size * 0.1))

  result.save(output_file, format="PNG")
  shutil.copy(output_file, f"slopes-cam/public/icons/{base_name}-maskable-{size}x{size}.png")
  os.remove("icons/temp_raw.png")
  print(f"Created {output_file}")


def create_favicon(svg_file):
  output_file = "favicon.ico"

  favicon_images = []
  for size in sizes["favicon"]:
    padding_ratio = -0.05
    icon_size = int(size * (1 - padding_ratio * 2))

    svg_content = get_white_svg_content(svg_file)

    cairosvg.svg2png(
      bytestring=svg_content,
      write_to="icons/temp_raw.png",
      output_width=icon_size,
      output_height=icon_size,
      background_color="transparent"
    )

    icon = Image.open("icons/temp_raw.png")
    icon = ImageOps.mirror(icon)

    background = create_gradient_background(size, size)

    padding = int(size * padding_ratio)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(background, (0, 0), background)
    result.paste(icon, (padding, padding), icon)

    result = round_corners(result, int(size * 0.15))

    favicon_images.append(result)

  favicon_images[0].save(
    output_file,
    format="ICO",
    sizes=[(img.width, img.height) for img in favicon_images],
    append_images=favicon_images[1:]
  )

  shutil.copy(output_file, "slopes-cam/public/favicon.ico")

  if os.path.exists("icons/temp_raw.png"):
    os.remove("icons/temp_raw.png")

  print(f"Created {output_file}")


for svg_file in svg_files:
  print(f"\nGenerating icons from {svg_file}:")
  for size in sizes["regular"]:
    create_regular_icon(svg_file, size)

  for size in sizes["maskable"]:
    create_maskable_icon(svg_file, size)

  create_favicon(svg_file)

print("\nAll PWA icons and favicon generated successfully!")