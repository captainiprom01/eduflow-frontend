from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def is_background_pixel(
    pixel: tuple[int, int, int, int],
    *,
    minimum_value: int,
    maximum_saturation: int,
) -> bool:
    """Check whether a pixel is close enough to white to be background."""
    red, green, blue, _ = pixel

    return (
        min(red, green, blue) >= minimum_value
        and max(red, green, blue) - min(red, green, blue)
        <= maximum_saturation
    )


def remove_border_background(
    image: Image.Image,
    *,
    minimum_value: int = 180,
    maximum_saturation: int = 38,
) -> int:
    """
    Make near-white pixels connected to the image border transparent.

    Enclosed white areas, such as the inside of a graduation cap, are kept.
    """
    pixels = image.load()
    width, height = image.size
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x

        if visited[index]:
            return

        visited[index] = 1

        if is_background_pixel(
            pixels[x, y],
            minimum_value=minimum_value,
            maximum_saturation=maximum_saturation,
        ):
            queue.append((x, y))

    # Add all border pixels as flood-fill starting points.
    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)

    for y in range(1, height - 1):
        enqueue(0, y)
        enqueue(width - 1, y)

    transparent_pixels = 0

    while queue:
        x, y = queue.popleft()
        red, green, blue, alpha = pixels[x, y]

        if alpha != 0:
            pixels[x, y] = (red, green, blue, 0)
            transparent_pixels += 1

        for neighbor_x, neighbor_y in (
            (x + 1, y),
            (x - 1, y),
            (x, y + 1),
            (x, y - 1),
        ):
            if 0 <= neighbor_x < width and 0 <= neighbor_y < height:
                enqueue(neighbor_x, neighbor_y)

    return transparent_pixels


def parse_args() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parent.parent

    parser = argparse.ArgumentParser(
        description="Remove the border-connected white background from a logo."
    )
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=repository_root / "icon.png",
        help="Input image path.",
    )
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=repository_root / "icon-transparent.png",
        help="Output image path.",
    )
    parser.add_argument(
        "--minimum-value",
        type=int,
        default=180,
        help="Minimum RGB value for background candidates.",
    )
    parser.add_argument(
        "--maximum-saturation",
        type=int,
        default=38,
        help="Maximum RGB channel difference for background candidates.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.input.is_file():
        raise SystemExit(f"Input image does not exist: {args.input}")

    if not 0 <= args.minimum_value <= 255:
        raise SystemExit("--minimum-value must be between 0 and 255")

    if not 0 <= args.maximum_saturation <= 255:
        raise SystemExit("--maximum-saturation must be between 0 and 255")

    args.output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(args.input) as source:
        image = source.convert("RGBA")
        width, height = image.size

        transparent_pixels = remove_border_background(
            image,
            minimum_value=args.minimum_value,
            maximum_saturation=args.maximum_saturation,
        )

        image.save(args.output, "PNG", optimize=True)

    print(f"Wrote {args.output} ({args.output.stat().st_size} bytes)")
    print(f"Image size: {width}x{height}")
    print(f"Transparent pixels: {transparent_pixels} / {width * height}")


if __name__ == "__main__":
    main()
