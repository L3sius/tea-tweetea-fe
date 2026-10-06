// The team's piece: a small pixel-art bird in the team's colour. Poses are CSS classes on the
// root element (see `.sprite-*` in BoardMap.vue), so changing pose never rebuilds the SVG.

// One character per pixel. B body, D wing, X outline, W eye white, K pupil, O beak and feet.
const BODY = [
  '....XXXX....',
  '...XBBBBX...',
  '..XBBBBBBX..',
  '..XBBBWKBX..',
  '..XBBBWWBOO.',
  '..XBBBBBBOO.',
  '.XBBBBBBBX..',
  '.XBDDBBBBBX.',
  '.XBDDDBBBBX.',
  '..XBDBBBBX..',
  '...XXXXXX...',
]
const FEET_A = ['...O...O....', '..OO..OO....']
const FEET_B = ['....O.O.....', '...OO.OO....']

const SIZE = 12

function rects(rows: string[], top: number, colors: Record<string, string>): string {
  let out = ''
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = colors[row.charAt(x)]
      if (fill) out += `<rect x="${x}" y="${y + top}" width="1.02" height="1.02" fill="${fill}"/>`
    }
  })
  return out
}

/** Pixel-art bird: `--team` colours its body. Feet alternate while `.walking`. */
export function spriteElement(color: string, label: string): HTMLElement {
  const colors = {
    X: '#0f172a',
    B: color,
    D: 'color-mix(in srgb, ' + color + ' 60%, #0f172a)',
    W: '#f8fafc',
    K: '#0f172a',
    O: '#f59e0b',
  }
  const root = document.createElement('div')
  root.className = 'sprite'
  root.innerHTML =
    `<div class="sprite-shadow"></div>` +
    `<div class="sprite-body">` +
    `<svg viewBox="0 0 ${SIZE} ${SIZE + 2}" shape-rendering="crispEdges" aria-hidden="true">` +
    rects(BODY, 0, colors) +
    `<g class="feet-a">${rects(FEET_A, 11, colors)}</g>` +
    `<g class="feet-b">${rects(FEET_B, 11, colors)}</g>` +
    `</svg></div>` +
    `<span class="sprite-label"></span>`
  const tag = root.querySelector('.sprite-label')
  if (tag) tag.textContent = label
  return root
}
