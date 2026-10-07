"""Cuts one terrain image per board tile from Explv's OSRS map, for the tile tooltip's land scene.

Run from the repo root with the board recorded in the fixtures (npm run fixtures:refresh):
    python scripts/terrain-scenes.py
Writes public/terrain/<x>_<y>.webp, named by world position so a board edit only adds the new
spots. Explv's map tiles are downloaded once into .cache/explv/ and reused on later runs.

Each image is the map around the tile at 2 screen pixels per world tile, the tile in its centre;
the tooltip shows it at 2x with nearest-neighbour scaling, so it stays crisp pixel art at a quarter
of the bytes of a full-resolution cut. About 6-7 KiB each. Sea tiles get none: their scene is
water.
"""
import io
import json
import os
import sys
import time
import urllib.request

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
BOARD = os.path.join(ROOT, 'src', 'api', 'fixtures', 'data', 'board.json')
OUT = os.path.join(ROOT, 'public', 'terrain')
CACHE = os.path.join(ROOT, '.cache', 'explv')
EXPLV = 'https://raw.githubusercontent.com/Explv/osrs_map_tiles/master/0'

# Keep in step with src/map/world.ts (CRS_ORIGIN) and the tooltip's terrain size (SCENE_TERRAIN).
ORIGIN_X, ORIGIN_Y = 960, 17600
ZOOM = 1  # Leaflet zoom: 2 screen pixels per world tile
WIDTH, HEIGHT = 162, 150  # shown at 2x: 324 x 300
TILE = 256


def explv_tile(tx, ty):
    ez = ZOOM + 6
    row = (1 << ez) - 1 - ty
    path = os.path.join(CACHE, str(ez), str(tx), f'{row}.png')
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        url = f'{EXPLV}/{ez}/{tx}/{row}.png'
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'tweetea-terrain/1.0'})
            data = urllib.request.urlopen(request, timeout=30).read()
        except Exception as error:  # off the edge of the map: no tile, draw black
            print('  missing', url, error, file=sys.stderr)
            data = b''
        with open(path, 'wb') as f:
            f.write(data)
        time.sleep(0.05)
    with open(path, 'rb') as f:
        data = f.read()
    return Image.open(io.BytesIO(data)).convert('RGB') if data else Image.new('RGB', (TILE, TILE))


def scene(x, y):
    scale = 2 ** ZOOM
    cx = (x + 0.5 - ORIGIN_X) * scale
    cy = (ORIGIN_Y - y - 0.5) * scale
    left, top = round(cx - WIDTH / 2), round(cy - HEIGHT / 2)
    out = Image.new('RGB', (WIDTH, HEIGHT))
    for tx in range(left // TILE, (left + WIDTH) // TILE + 1):
        for ty in range(top // TILE, (top + HEIGHT) // TILE + 1):
            out.paste(explv_tile(tx, ty), (tx * TILE - left, ty * TILE - top))
    return out


def main():
    with open(BOARD, encoding='utf8') as f:
        board = json.load(f)
    os.makedirs(OUT, exist_ok=True)
    land = [t for t in board['tiles'] if not t['sea']]
    wanted = {f"{t['x']}_{t['y']}.webp" for t in land}
    written = total = 0
    for t in land:
        name = f"{t['x']}_{t['y']}.webp"
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            # 64 colours keep the pixel edges crisp (lossy WebP blurs them) at a quarter of the
            # bytes of the full palette; the banding it puts in soft gradients suits pixel art.
            image = scene(t['x'], t['y']).quantize(64, dither=Image.Dither.NONE).convert('RGB')
            image.save(path, 'WEBP', lossless=True, quality=100, method=6)
            written += 1
        total += os.path.getsize(path)
    stale = [n for n in os.listdir(OUT) if n.endswith('.webp') and n not in wanted]
    for name in stale:  # spots no longer on the board
        os.remove(os.path.join(OUT, name))
    print(f'{len(land)} land tiles, {written} new, {len(stale)} removed, {total / 1024:.0f} KiB in all')


if __name__ == '__main__':
    main()
