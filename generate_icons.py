#!/usr/bin/env python3
import os
import cairosvg
from PIL import Image

sizes = {
    "regular": [16, 32, 180, 192, 512],
    "maskable": [192, 512]
}

if not os.path.exists('icons'):
    os.makedirs('icons')

if not os.path.isfile('icons/skiing.svg'):
    print("Error: skiing.svg not found!")
    exit(1)


def create_regular_icon(size):
    output_file = f"icons/skiing-{size}x{size}.png"

    cairosvg.svg2png(
        url="icons/skiing.svg",
        write_to=output_file,
        output_width=size,
        output_height=size,
        background_color="#121212"
    )

    img = Image.open(output_file)
    img.save(output_file)
    print(f"Created {output_file}")


def create_maskable_icon(size):
    output_file = f"icons/skiing-maskable-{size}x{size}.png"

    safe_zone_ratio = 0.8
    icon_size = int(size * safe_zone_ratio)
    padding = (size - icon_size) // 2

    img = Image.new('RGBA', (size, size), color="#121212")

    temp_file = "icons/temp_icon.png"
    cairosvg.svg2png(
        url="icons/skiing.svg",
        write_to=temp_file,
        output_width=icon_size,
        output_height=icon_size,
        background_color="transparent"
    )

    icon = Image.open(temp_file)
    img.paste(icon, (padding, padding), icon)
    img.save(output_file)
    os.remove(temp_file)

    print(f"Created {output_file}")


for size in sizes["regular"]:
    create_regular_icon(size)

for size in sizes["maskable"]:
    create_maskable_icon(size)

print("\nAll PWA icons generated successfully!")