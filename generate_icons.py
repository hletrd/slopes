#!/usr/bin/env python3
import os
import cairosvg
from PIL import Image, ImageOps, ImageDraw

sizes = {
    "regular": [16, 32, 180, 192, 512],
    "maskable": [192, 512]
}

if not os.path.exists('icons'):
    os.makedirs('icons')

if not os.path.isfile('icons/skiing.svg'):
    print("Error: skiing.svg not found!")
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


def create_regular_icon(size):
    output_file = f"icons/skiing-{size}x{size}.png"

    padding_ratio = 0.1
    icon_size = int(size * (1 - padding_ratio * 2))

    cairosvg.svg2png(
        url="icons/skiing.svg",
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


def create_maskable_icon(size):
    output_file = f"icons/skiing-maskable-{size}x{size}.png"

    outer_padding_ratio = 0.1
    inner_safe_zone_ratio = 0.8

    actual_icon_size = int(size * inner_safe_zone_ratio *
                          (1 - outer_padding_ratio * 2))

    cairosvg.svg2png(
        url="icons/skiing.svg",
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


for size in sizes["regular"]:
    create_regular_icon(size)

for size in sizes["maskable"]:
    create_maskable_icon(size)

print("\nAll PWA icons generated successfully!")