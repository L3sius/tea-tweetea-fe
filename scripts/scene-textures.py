"""Generates the pixel-art textures and frames for the tile tooltip scene.

Run from the repo root: python scripts/scene-textures.py
Writes PNGs to src/assets/tt/img/scene/. Everything is drawn at native pixel size and shown at 2x
with nearest-neighbour scaling, so keep shapes chunky. Deterministic: the same seed draws the same
pixels, so regenerating does not churn the images.
"""
import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'tt', 'img', 'scene')
OUTLINE = (20, 16, 12, 255)
CLEAR = (0, 0, 0, 0)


def rgb(hex_colour, alpha=255):
    h = hex_colour.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def shade(colour, amount):
    r, g, b, a = colour
    f = lambda c: max(0, min(255, int(c + amount)))
    return (f(r), f(g), f(b), a)


def value_noise(w, h, cell, rng):
    """Smooth tileable noise in 0..1: random values on a wrapping grid, bilinearly blended."""
    gw, gh = w // cell, h // cell
    grid = [[rng.random() for _ in range(gw)] for _ in range(gh)]
    out = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            gx, gy = x / cell, y / cell
            x0, y0 = int(gx) % gw, int(gy) % gh
            x1, y1 = (x0 + 1) % gw, (y0 + 1) % gh
            tx, ty = gx - int(gx), gy - int(gy)
            top = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx
            bottom = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx
            out[y][x] = top * (1 - ty) + bottom * ty
    return out


def parchment_fill(w, h, rng, base='#7a6646'):
    """Weathered parchment: blotchy tone, speckles and short fibres, tileable."""
    im = Image.new('RGBA', (w, h))
    px = im.load()
    big, small = value_noise(w, h, 16, rng), value_noise(w, h, 4, rng)
    base_c = rgb(base)
    for y in range(h):
        for x in range(w):
            v = (big[y][x] - 0.5) * 22 + (small[y][x] - 0.5) * 8
            # Posterise to a few tones so it reads as pixel art, not a photo.
            px[x, y] = shade(base_c, round(v / 5) * 5)
    for _ in range(w * h // 40):
        x, y = rng.randrange(w), rng.randrange(h)
        px[x, y] = shade(px[x, y], rng.choice((-18, -12, 10)))
    for _ in range(w * h // 300):
        x, y = rng.randrange(w), rng.randrange(h)
        for i in range(rng.randrange(2, 5)):
            px[(x + i) % w, y] = shade(px[(x + i) % w, y], -10)
    return im


def write(name, im):
    im.save(os.path.join(OUT, name))
    print('wrote', name, im.size)


def parchment_panel(rng):
    """9-slice parchment with a torn, outlined edge and gold rivets; slice 10, fill."""
    s, n = 10, 60
    im = parchment_fill(n, n, rng)
    px = im.load()
    edge = [rng.choice((0, 0, 1, 1, 2)) for _ in range(n)]
    for i in range(n):
        for d in range(edge[i]):  # torn bits along each side
            px[i, d] = CLEAR
            px[i, n - 1 - d] = CLEAR
            px[d, i] = CLEAR
            px[n - 1 - d, i] = CLEAR
    # Corners rounded off by a pixel or two.
    for (cx, cy) in ((0, 0), (n - 1, 0), (0, n - 1), (n - 1, n - 1)):
        for dx in range(3):
            for dy in range(3 - dx):
                px[abs(cx - dx), abs(cy - dy)] = CLEAR
    outline(im)
    # Darker band just inside the edge: burnt, aged rim.
    for y in range(n):
        for x in range(n):
            if px[x, y][3] and min(x, y, n - 1 - x, n - 1 - y) in (3, 4):
                px[x, y] = shade(px[x, y], -14)
    # A little see-through inside the rim, so the scene shows faintly behind the task.
    for y in range(n):
        for x in range(n):
            r, g, b, a = px[x, y]
            if a and px[x, y] != OUTLINE and min(x, y, n - 1 - x, n - 1 - y) > 4:
                px[x, y] = (r, g, b, 205)
    for (cx, cy) in ((5, 5), (n - 6, 5), (5, n - 6), (n - 6, n - 6)):
        rivet(px, cx, cy)
    write('parchment-panel.png', im)
    return s


def outline(im):
    """A 1px dark outline around every opaque area, drawn on its outermost pixels."""
    px = im.load()
    w, h = im.size
    solid = [[px[x, y][3] > 0 for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            if not solid[y][x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or not solid[ny][nx]:
                    px[x, y] = OUTLINE
                    break


def rivet(px, cx, cy):
    gold, light, dark = rgb('#c99a2e'), rgb('#f2d36b'), rgb('#6e4d12')
    for dx, dy in ((0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)):
        px[cx + dx, cy + dy] = gold
    px[cx, cy - 1] = light
    px[cx - 1, cy] = light
    px[cx + 1, cy] = dark
    px[cx, cy + 1] = dark


def water(rng):
    """Tileable sea: layered wave rows of navy and blue, crests and a little foam."""
    w, h = 96, 48
    deep, mid, crest, foam = rgb('#173a5c'), rgb('#1f4c74'), rgb('#3d77a6'), rgb('#cfe8f5')
    im = Image.new('RGBA', (w, h), deep)
    px = im.load()
    for row in range(0, h, 8):
        phase = rng.randrange(w)
        for x in range(w):
            # A blocky wave line: 2px swell with a crest on top.
            wave = row + (2 if ((x + phase) // 6) % 2 else 0)
            for y in range(wave + 2, min(h, wave + 5)):
                px[x, y % h] = mid
            px[x, (wave + 1) % h] = crest
        for _ in range(4):
            x = rng.randrange(w)
            for i in range(rng.randrange(2, 4)):
                px[(x + i) % w, (row + 1) % h] = foam
    for _ in range(40):
        x, y = rng.randrange(w), rng.randrange(h)
        if px[x, y] == deep:
            px[x, y] = shade(deep, -8)
    write('water.png', im)


def wave_frame(rng):
    """9-slice frame for sea tiles; slice 16. The tile's edge is a row of blocky breaking waves:
    ragged and see-through on the outside, foam on the crests, then open water that runs on into
    the water texture inside (the inner part is transparent, so the texture shows)."""
    n, s = 64, 16
    im = Image.new('RGBA', (n, n), CLEAR)
    px = im.load()
    deep, mid = rgb('#173a5c'), rgb('#1f4c74')
    light, foam = rgb('#8cc3e3'), rgb('#e6f4fb')

    def reach(i):
        # Where the water starts along a side: blocky crests 6px apart, 0..4px in from the edge.
        return (0, 1, 2, 4, 2, 1)[(i // 2) % 6]

    for y in range(n):
        for x in range(n):
            d = min(x, y, n - 1 - x, n - 1 - y)
            along = x if d in (y, n - 1 - y) else y
            r = reach(along)
            if d < r or d >= 14:
                continue
            k = d - r
            if k == 0:
                px[x, y] = OUTLINE
            elif k <= 2:
                px[x, y] = foam
            elif k <= 4:
                px[x, y] = light if (along + k) % 5 else foam
            else:
                px[x, y] = mid if (along // 3 + k) % 4 == 0 else deep
    for _ in range(50):  # spray on the water just inside the crests
        x, y = rng.randrange(n), rng.randrange(n)
        d = min(x, y, n - 1 - x, n - 1 - y)
        if 8 <= d <= 12 and px[x, y][3]:
            px[x, y] = foam
    write('frame-sea.png', im)
    return s


def outline_outer(im):
    """Outline only where the frame meets the outside of the image."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and min(x, y, w - 1 - x, h - 1 - y) == 0:
                px[x, y] = OUTLINE


def earth_frame(rng):
    """9-slice frame for land tiles: stone and packed earth, grass on top; slice 16."""
    n, s = 64, 16
    im = Image.new('RGBA', (n, n), CLEAR)
    px = im.load()
    stones = [rgb('#6f6a62'), rgb('#857f75'), rgb('#5b564f')]
    dirt, dirt_dark = rgb('#5e4630'), rgb('#4a3726')
    grass, grass_light = rgb('#3f6b2a'), rgb('#5c8f39')
    for y in range(n):
        for x in range(n):
            d = min(x, y, n - 1 - x, n - 1 - y)
            if d >= 8:
                continue
            if d < 2:
                px[x, y] = OUTLINE if d == 0 else dirt_dark
                continue
            # Stones: a coarse grid, each block its own grey.
            bx, by = (x + (y // 4) * 2) // 4, y // 4
            stone = stones[(bx * 7 + by * 3) % 3]
            px[x, y] = stone if (x % 4 and y % 4) else dirt
            if d == 7:
                px[x, y] = dirt_dark
    # Grass along the top edge and in tufts down the sides.
    for x in range(n):
        top = 2 + (1 if (x // 3) % 2 else 0)
        for y in range(top, 6):
            px[x, y] = grass if y > top else grass_light
        if rng.random() < 0.35:
            px[x, top - 1] = grass_light
    for _ in range(24):
        side = rng.choice(('l', 'r', 'b'))
        i = rng.randrange(8, n - 8)
        x, y = {'l': (rng.randrange(2, 7), i), 'r': (n - 1 - rng.randrange(2, 7), i), 'b': (i, n - 1 - rng.randrange(2, 7))}[side]
        px[x, y] = grass_light
    # A ragged outer edge: knock out a pixel or two here and there, then outline what is left.
    for i in range(n):
        for side in range(4):
            if rng.random() < 0.3:
                x, y = ((i, 0), (i, n - 1), (0, i), (n - 1, i))[side]
                px[x, y] = CLEAR
    outline(im)
    write('frame-land.png', im)
    return s


def plate(rng):
    """9-slice dark iron plate with gold studs at the ends, for the small tile number; slice 6."""
    w, h = 24, 16
    im = Image.new('RGBA', (w, h), rgb('#2d2a26'))
    px = im.load()
    for x in range(w):
        px[x, 1] = rgb('#57524a')
        px[x, h - 2] = rgb('#1d1b18')
    for y in range(h):
        px[1, y] = rgb('#4a463f')
        px[w - 2, y] = rgb('#1d1b18')
    for (cx, cy) in ((3, h // 2), (w - 4, h // 2)):
        rivet(px, cx, cy)
    for y in range(h):
        for x in range(w):
            if min(x, y, w - 1 - x, h - 1 - y) == 0:
                px[x, y] = OUTLINE
    for (cx, cy) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px[cx, cy] = CLEAR
    write('plate.png', im)


def cloth_edge(rng):
    """Mask for the bottom of a cloth banner: solid on top, a frayed, blocky edge below. Repeats
    along x; only its alpha matters (it is used as a CSS mask)."""
    w, h = 32, 6
    im = Image.new('RGBA', (w, h), CLEAR)
    px = im.load()
    depth = [rng.choice((2, 3, 3, 4, 5)) for _ in range(w // 2)]
    for x in range(w):
        for y in range(depth[x // 2]):
            px[x, y] = (0, 0, 0, 255)
    write('cloth-edge.png', im)


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = random.Random(398)
    parchment_panel(rng)
    water(rng)
    wave_frame(rng)
    earth_frame(rng)
    plate(rng)
    cloth_edge(rng)


if __name__ == '__main__':
    main()
