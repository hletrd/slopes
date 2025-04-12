#!/usr/bin/env python3
import os
import re
import cairosvg
from PIL import Image, ImageOps, ImageDraw

sizes = {
    "regular": [16, 32, 180, 192, 512],
    "maskable": [192, 512]
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

    result.save(output_file, format="PNG")
    os.remove("icons/temp_raw.png")
    print(f"Created {output_file}")


def create_maskable_icon(svg_file, size):
    base_name = os.path.splitext(svg_file)[0]
    output_file = f"icons/{base_name}-maskable-{size}x{size}.png"

    outer_padding_ratio = 0.1
    inner_safe_zone_ratio = 0.8

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

    result.save(output_file, format="PNG")
    os.remove("icons/temp_raw.png")
    print(f"Created {output_file}")


for svg_file in svg_files:
    print(f"\nGenerating icons from {svg_file}:")
    for size in sizes["regular"]:
        create_regular_icon(svg_file, size)

    for size in sizes["maskable"]:
        create_maskable_icon(svg_file, size)

print("\nAll PWA icons generated successfully!")