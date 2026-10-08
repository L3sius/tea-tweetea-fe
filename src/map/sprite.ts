// The team's piece: a small pixel-art bird in the team's colour, or an OSRS character
// (see characters/stage.ts) drawn into a canvas in the same frame. Poses are CSS classes on the
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

/** The piece's frame around `body`: a shadow underneath and the team name below. */
function frame(body: string | Node, color: string, label: string): HTMLElement {
  const root = document.createElement('div')
  root.className = 'sprite'
  root.style.setProperty('--team', color)
  root.innerHTML =
    `<div class="sprite-shadow"></div><div class="sprite-body"></div>` +
    `<span class="sprite-label"></span>`
  const slot = root.querySelector('.sprite-body')
  if (slot && typeof body === 'string') slot.innerHTML = body
  else if (slot) slot.append(body)
  const tag = root.querySelector('.sprite-label')
  if (tag) tag.textContent = label
  return root
}

/** An OSRS character piece: `canvas` is drawn by its CharacterPiece. */
export function characterElement(canvas: HTMLCanvasElement, color: string, label: string) {
  return frame(canvas, color, label)
}

/** Pixel-art bird: `--team` colours its body. Feet alternate while `.walking`. */
export function spriteElement(color: string, label: string): HTMLElement {
  const colors = {
    X: '#000000',
    B: color,
    D: 'color-mix(in srgb, ' + color + ' 60%, #000000)',
    W: '#ffffff',
    K: '#000000',
    O: '#ff981f',
  }
  return frame(
    `<svg viewBox="0 0 ${SIZE} ${SIZE + 2}" shape-rendering="crispEdges" aria-hidden="true">` +
      rects(BODY, 0, colors) +
      `<g class="feet-a">${rects(FEET_A, 11, colors)}</g>` +
      `<g class="feet-b">${rects(FEET_B, 11, colors)}</g>` +
      `</svg>`,
    color,
    label,
  )
}
