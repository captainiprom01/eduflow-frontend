from pathlib import Path
from PIL import Image

ROOT = Path('/home/ubuntu/eduflow-frontend')
source = Image.open(ROOT / 'icon-transparent.png').convert('RGBA')

# Browser favicon: preserve the complete logo and transparency.
favicon = source.copy()
favicon.thumbnail((192, 192), Image.Resampling.LANCZOS)
favicon.save(ROOT / 'favicon.png', 'PNG', optimize=True)

# PWA icons: use the complete logo centered on a transparent square so the
# app icon and splash use the same artwork. The source is kept within the
# safe area and preserves its original aspect ratio.
def square_icon(size, path, background=None):
    canvas = Image.new('RGBA', (size, size), background or (0, 0, 0, 0))
    logo = source.copy()
    logo.thumbnail((int(size * 0.9), int(size * 0.9)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    canvas.save(ROOT / path, 'PNG', optimize=True)

square_icon(192, 'icon-192.png')
square_icon(512, 'icon-512.png')
square_icon(512, 'icon-512-maskable.png', (13, 20, 64, 255))
print('Generated favicon.png, icon-192.png, icon-512.png, icon-512-maskable.png')
