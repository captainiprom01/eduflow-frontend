from pathlib import Path
from collections import deque
from PIL import Image

src = Path('/home/ubuntu/eduflow-frontend/icon.png')
out = Path('/home/ubuntu/eduflow-frontend/icon-transparent.png')
image = Image.open(src).convert('RGBA')
pixels = image.load()
width, height = image.size

# Treat only near-white, low-saturation pixels as background candidates. The
# connected component touching the image border is the white canvas; enclosed
# components (such as the white graduation cap) remain part of the logo.
def is_white_canvas_pixel(x, y):
    r, g, b, _ = pixels[x, y]
    return min(r, g, b) >= 180 and max(r, g, b) - min(r, g, b) <= 38

candidate = bytearray(width * height)
for y in range(height):
    for x in range(width):
        candidate[y * width + x] = 1 if is_white_canvas_pixel(x, y) else 0

seen = bytearray(width * height)
background = set()
for start_y in range(height):
    for start_x in range(width):
        start = start_y * width + start_x
        if not candidate[start] or seen[start]:
            continue
        queue = deque([(start_x, start_y)])
        seen[start] = 1
        component = []
        touches_border = False
        while queue:
            x, y = queue.popleft()
            component.append((x, y))
            if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                touches_border = True
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    index = ny * width + nx
                    if candidate[index] and not seen[index]:
                        seen[index] = 1
                        queue.append((nx, ny))
        if touches_border:
            background.update(component)

for x, y in background:
    r, g, b, _ = pixels[x, y]
    pixels[x, y] = (r, g, b, 0)

image.save(out, 'PNG', optimize=True)
print(f'Wrote {out} ({out.stat().st_size} bytes)')
print(f'Transparent pixels: {sum(1 for px in image.getdata() if px[3] == 0)} / {width * height}')
